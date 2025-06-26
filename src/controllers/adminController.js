const supabase = require('../config/database');
const emailService = require('../services/emailService');
const cacheService = require('../services/CacheService');

class AdminController {
    // USC18: Ban/Unban account
    async banAccount(req, res) {
        try {
            const adminId = req.user.id;
            const { userId, reason, duration = null } = req.body;
            
            // Cannot ban another admin
            const { data: targetUser, error: userError } = await supabase
                .from('users')
                .select('role, email, full_name')
                .eq('id', userId)
                .single();
                
            if (userError || !targetUser) {
                return res.status(404).json({
                    success: false,
                    error: 'Người dùng không tồn tại'
                });
            }
            
            if (targetUser.role === 'admin') {
                return res.status(403).json({
                    success: false,
                    error: 'Không thể cấm tài khoản admin'
                });
            }
            
            // Update user status
            const banExpiry = duration 
                ? new Date(Date.now() + duration * 24 * 60 * 60 * 1000)
                : null;
                
            const { error: updateError } = await supabase
                .from('users')
                .update({
                    status: 'suspended',
                    suspension_reason: reason,
                    suspension_expires: banExpiry,
                    updated_at: new Date()
                })
                .eq('id', userId);
                
            if (updateError) throw updateError;
            
            // Log admin action
            await supabase
                .from('admin_logs')
                .insert({
                    admin_id: adminId,
                    action: 'ban_account',
                    details: {
                        target_user_id: userId,
                        reason: reason,
                        duration: duration,
                        ban_expiry: banExpiry
                    },
                    ip_address: req.ip,
                    user_agent: req.get('User-Agent')
                });
                
            // Send notification email
            await emailService.sendAccountSuspension({
                to: targetUser.email,
                fullName: targetUser.full_name,
                reason: reason,
                duration: duration
            });
            
            res.json({
                success: true,
                message: `Đã cấm tài khoản ${targetUser.email}`,
                data: {
                    userId: userId,
                    banExpiry: banExpiry
                }
            });
            
        } catch (error) {
            console.error('Ban account error:', error);
            res.status(500).json({
                success: false,
                error: 'Không thể cấm tài khoản'
            });
        }
    }
    
    // Unban account
    async unbanAccount(req, res) {
        try {
            const adminId = req.user.id;
            const { userId } = req.body;
            
            // Update user status
            const { data: user, error } = await supabase
                .from('users')
                .update({
                    status: 'active',
                    suspension_reason: null,
                    suspension_expires: null,
                    updated_at: new Date()
                })
                .eq('id', userId)
                .select()
                .single();
                
            if (error) throw error;
            
            // Log admin action
            await supabase
                .from('admin_logs')
                .insert({
                    admin_id: adminId,
                    action: 'unban_account',
                    details: {
                        target_user_id: userId
                    },
                    ip_address: req.ip,
                    user_agent: req.get('User-Agent')
                });
                
            res.json({
                success: true,
                message: `Đã mở khóa tài khoản ${user.email}`,
                data: { userId }
            });
            
        } catch (error) {
            console.error('Unban account error:', error);
            res.status(500).json({
                success: false,
                error: 'Không thể mở khóa tài khoản'
            });
        }
    }
    
    // USC19: Approve Teacher Requests
    async getTeacherRequests(req, res) {
        try {
            const { status = 'pending' } = req.query;
            
            const { data: requests, error } = await supabase
                .from('teacher_requests')
                .select(`
                    *,
                    user:users(
                        id,
                        email,
                        full_name,
                        created_at
                    )
                `)
                .eq('status', status)
                .order('created_at', { ascending: true });
                
            if (error) throw error;
            
            res.json({
                success: true,
                data: requests
            });
            
        } catch (error) {
            console.error('Get teacher requests error:', error);
            res.status(500).json({
                success: false,
                error: 'Không thể lấy danh sách yêu cầu'
            });
        }
    }
    
    async approveTeacherRequest(req, res) {
        try {
            const adminId = req.user.id;
            const { requestId } = req.params;
            const { approved, reason } = req.body;
            
            // Get request details
            const { data: request, error: requestError } = await supabase
                .from('teacher_requests')
                .select('*, user:users(*)')
                .eq('id', requestId)
                .single();
                
            if (requestError || !request) {
                return res.status(404).json({
                    success: false,
                    error: 'Yêu cầu không tồn tại'
                });
            }
            
            // Update request status
            const { error: updateError } = await supabase
                .from('teacher_requests')
                .update({
                    status: approved ? 'approved' : 'rejected',
                    reviewed_by: adminId,
                    review_reason: reason,
                    reviewed_at: new Date()
                })
                .eq('id', requestId);
                
            if (updateError) throw updateError;
            
            // If approved, update user role
            if (approved) {
                await supabase
                    .from('users')
                    .update({ role: 'teacher' })
                    .eq('id', request.user_id);
            }
            
            // Log admin action
            await supabase
                .from('admin_logs')
                .insert({
                    admin_id: adminId,
                    action: 'review_teacher_request',
                    details: {
                        request_id: requestId,
                        user_id: request.user_id,
                        approved: approved,
                        reason: reason
                    },
                    ip_address: req.ip,
                    user_agent: req.get('User-Agent')
                });
                
            // Send notification email
            await emailService.sendTeacherRequestResult({
                to: request.user.email,
                fullName: request.user.full_name,
                approved: approved,
                reason: reason
            });
            
            res.json({
                success: true,
                message: approved 
                    ? 'Đã phê duyệt yêu cầu làm giáo viên'
                    : 'Đã từ chối yêu cầu làm giáo viên'
            });
            
        } catch (error) {
            console.error('Approve teacher request error:', error);
            res.status(500).json({
                success: false,
                error: 'Không thể xử lý yêu cầu'
            });
        }
    }
    
    // USC20: Moderate Content
    async getReportedContent(req, res) {
        try {
            const { type = 'all', status = 'pending' } = req.query;
            
            let query = supabase
                .from('content_reports')
                .select(`
                    *,
                    reporter:users!reporter_id(email, full_name),
                    content:vocabulary_lists(id, name, owner_id)
                `)
                .eq('status', status)
                .order('created_at', { ascending: true });
                
            if (type !== 'all') {
                query = query.eq('content_type', type);
            }
            
            const { data: reports, error } = await query;
            
            if (error) throw error;
            
            res.json({
                success: true,
                data: reports
            });
            
        } catch (error) {
            console.error('Get reported content error:', error);
            res.status(500).json({
                success: false,
                error: 'Không thể lấy danh sách báo cáo'
            });
        }
    }
    
    async moderateContent(req, res) {
        try {
            const adminId = req.user.id;
            const { reportId } = req.params;
            const { action, reason } = req.body; // action: 'remove', 'dismiss', 'warn'
            
            // Get report details
            const { data: report, error: reportError } = await supabase
                .from('content_reports')
                .select('*')
                .eq('id', reportId)
                .single();
                
            if (reportError || !report) {
                return res.status(404).json({
                    success: false,
                    error: 'Báo cáo không tồn tại'
                });
            }
            
            // Update report status
            const { error: updateError } = await supabase
                .from('content_reports')
                .update({
                    status: 'resolved',
                    resolution: action,
                    resolved_by: adminId,
                    resolution_reason: reason,
                    resolved_at: new Date()
                })
                .eq('id', reportId);
                
            if (updateError) throw updateError;
            
            // Take action based on decision
            if (action === 'remove') {
                // Remove content
                await supabase
                    .from(report.content_type)
                    .update({ is_active: false, removed_reason: reason })
                    .eq('id', report.content_id);
                    
                // Notify content owner
                const { data: content } = await supabase
                    .from(report.content_type)
                    .select('owner_id')
                    .eq('id', report.content_id)
                    .single();
                    
                if (content) {
                    await supabase
                        .from('notifications')
                        .insert({
                            user_id: content.owner_id,
                            title: 'Nội dung bị gỡ',
                            message: `Nội dung của bạn đã bị gỡ vì: ${reason}`,
                            type: 'warning'
                        });
                }
            } else if (action === 'warn') {
                // Send warning to content owner
                const { data: content } = await supabase
                    .from(report.content_type)
                    .select('owner_id')
                    .eq('id', report.content_id)
                    .single();
                    
                if (content) {
                    await supabase
                        .from('notifications')
                        .insert({
                            user_id: content.owner_id,
                            title: 'Cảnh báo vi phạm',
                            message: `Nội dung của bạn bị báo cáo: ${reason}`,
                            type: 'warning'
                        });
                }
            }
            
            // Log admin action
            await supabase
                .from('admin_logs')
                .insert({
                    admin_id: adminId,
                    action: 'moderate_content',
                    details: {
                        report_id: reportId,
                        action: action,
                        reason: reason
                    },
                    ip_address: req.ip,
                    user_agent: req.get('User-Agent')
                });
                
            res.json({
                success: true,
                message: 'Đã xử lý báo cáo thành công'
            });
            
        } catch (error) {
            console.error('Moderate content error:', error);
            res.status(500).json({
                success: false,
                error: 'Không thể xử lý báo cáo'
            });
        }
    }
    
    // USC21: View system analytics
    async getSystemAnalytics(req, res) {
        try {
            const { period = '30d' } = req.query;
            
            // Calculate date range
            const endDate = new Date();
            const startDate = new Date();
            switch(period) {
                case '24h': startDate.setDate(startDate.getDate() - 1); break;
                case '7d': startDate.setDate(startDate.getDate() - 7); break;
                case '30d': startDate.setDate(startDate.getDate() - 30); break;
                case '90d': startDate.setDate(startDate.getDate() - 90); break;
            }
            
            // Get user statistics
            const { data: userStats, error: userError } = await supabase
                .rpc('get_user_statistics', {
                    start_date: startDate.toISOString(),
                    end_date: endDate.toISOString()
                });
                
            if (userError) throw userError;
            
            // Get content statistics
            const { count: totalVocabulary } = await supabase
                .from('vocabulary')
                .select('*', { count: 'exact', head: true })
                .eq('is_active', true);
                
            const { count: totalLists } = await supabase
                .from('vocabulary_lists')
                .select('*', { count: 'exact', head: true });
                
            const { count: totalClassrooms } = await supabase
                .from('classrooms')
                .select('*', { count: 'exact', head: true })
                .eq('is_active', true);
                
            // Get activity statistics
            const { data: dailyActivity } = await supabase
                .rpc('get_daily_activity', {
                    start_date: startDate.toISOString(),
                    end_date: endDate.toISOString()
                });
                
            // Get performance metrics
            const { data: performance } = await supabase
                .from('user_stats')
                .select('total_reviews, correct_reviews')
                .gte('updated_at', startDate.toISOString());
                
            const totalReviews = performance?.reduce((sum, p) => sum + p.total_reviews, 0) || 0;
            const correctReviews = performance?.reduce((sum, p) => sum + p.correct_reviews, 0) || 0;
            
            const analytics = {
                period: period,
                users: {
                    total: userStats?.total_users || 0,
                    active: userStats?.active_users || 0,
                    new: userStats?.new_users || 0,
                    byRole: userStats?.users_by_role || {}
                },
                content: {
                    totalVocabulary: totalVocabulary || 0,
                    totalLists: totalLists || 0,
                    totalClassrooms: totalClassrooms || 0
                },
                activity: {
                    totalReviews: totalReviews,
                    averageAccuracy: totalReviews > 0 
                        ? Math.round((correctReviews / totalReviews) * 100)
                        : 0,
                    dailyActivity: dailyActivity || []
                },
                topMetrics: {
                    mostActiveUsers: [],
                    popularVocabularyLists: [],
                    activeClassrooms: []
                }
            };
            
            res.json({
                success: true,
                data: analytics
            });
            
        } catch (error) {
            console.error('Get system analytics error:', error);
            res.status(500).json({
                success: false,
                error: 'Không thể lấy thống kê hệ thống'
            });
        }
    }
    
    // Get admin logs
    async getAdminLogs(req, res) {
        try {
            const { page = 1, limit = 50, action, adminId } = req.query;
            const offset = (page - 1) * limit;
            
            let query = supabase
                .from('admin_logs')
                .select(`
                    *,
                    admin:users!admin_id(email, full_name)
                `, { count: 'exact' })
                .order('timestamp', { ascending: false })
                .range(offset, offset + limit - 1);
                
            if (action) {
                query = query.eq('action', action);
            }
            
            if (adminId) {
                query = query.eq('admin_id', adminId);
            }
            
            const { data: logs, error, count } = await query;
            
            if (error) throw error;
            
            res.json({
                success: true,
                data: {
                    logs: logs,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total: count,
                        totalPages: Math.ceil(count / limit)
                    }
                }
            });
            
        } catch (error) {
            console.error('Get admin logs error:', error);
            res.status(500).json({
                success: false,
                error: 'Không thể lấy lịch sử admin'
            });
        }
    }
    
    // System health check
    async getSystemHealth(req, res) {
        try {
            const health = {
                status: 'healthy',
                timestamp: new Date(),
                services: {}
            };
            
            // Check database
            try {
                const { error } = await supabase
                    .from('users')
                    .select('count')
                    .limit(1)
                    .single();
                health.services.database = error ? 'unhealthy' : 'healthy';
            } catch {
                health.services.database = 'unhealthy';
            }
            
            // Check email service
            try {
                const emailStatus = await emailService.checkConnection();
                health.services.email = emailStatus.status === 'connected' ? 'healthy' : 'unhealthy';
            } catch {
                health.services.email = 'unhealthy';
            }
            
            // Check cache (Redis)
            try {
                await cacheService.get('health_check');
                health.services.cache = 'healthy';
            } catch {
                health.services.cache = 'unhealthy';
            }
            
            // Overall health
            health.status = Object.values(health.services).every(s => s === 'healthy') 
                ? 'healthy' 
                : 'degraded';
                
            res.json({
                success: true,
                data: health
            });
            
        } catch (error) {
            console.error('System health check error:', error);
            res.status(500).json({
                success: false,
                error: 'Không thể kiểm tra tình trạng hệ thống',
                data: {
                    status: 'unhealthy',
                    timestamp: new Date()
                }
            });
        }
    }

    // Export analytics as downloadable JSON
    async exportAnalytics(req, res) {
        try {
            const { period = '30d' } = req.query;
            const analytics = await this.fetchAnalytics(period);

            res.setHeader('Content-Disposition', 'attachment; filename="analytics.json"');
            res.json({ success: true, data: analytics });
        } catch (error) {
            console.error('Export analytics error:', error);
            res.status(500).json({ success: false, error: 'Không thể xuất thống kê' });
        }
    }

    // List users with pagination and filtering
    async getUsers(req, res) {
        try {
            const { page = 1, limit = 20, search, role, status } = req.query;
            const offset = (page - 1) * limit;

            let query = supabase
                .from('users')
                .select('id, email, full_name, role, status, created_at', { count: 'exact' })
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

            if (search) query = query.ilike('email', `%${search}%`);
            if (role) query = query.eq('role', role);
            if (status) query = query.eq('status', status);

            const { data: users, error, count } = await query;
            if (error) throw error;

            res.json({
                success: true,
                data: {
                    users,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total: count,
                        totalPages: Math.ceil(count / limit)
                    }
                }
            });
        } catch (error) {
            console.error('Get users error:', error);
            res.status(500).json({ success: false, error: 'Không thể lấy danh sách người dùng' });
        }
    }

    // Update user by admin
    async updateUser(req, res) {
        try {
            const { userId } = req.params;
            const { role, status, fullName } = req.body;

            const updates = {};
            if (role) updates.role = role;
            if (status) updates.status = status;
            if (fullName) updates.full_name = fullName;

            const { data: user, error } = await supabase
                .from('users')
                .update(updates)
                .eq('id', userId)
                .select('id, email, full_name, role, status')
                .single();

            if (error) throw error;

            res.json({ success: true, data: user });
        } catch (error) {
            console.error('Update user error:', error);
            res.status(500).json({ success: false, error: 'Không thể cập nhật người dùng' });
        }
    }

    // Bulk actions on users
    async bulkUserAction(req, res) {
        try {
            const { userIds = [], action } = req.body;
            if (userIds.length === 0) {
                return res.status(400).json({ success: false, error: 'Danh sách người dùng trống' });
            }

            let query = supabase.from('users');
            if (action === 'delete') {
                query = query.delete();
            } else if (action === 'activate') {
                query = query.update({ status: 'active' });
            } else if (action === 'deactivate') {
                query = query.update({ status: 'inactive' });
            } else {
                return res.status(400).json({ success: false, error: 'Hành động không hợp lệ' });
            }

            const { error } = await query.in('id', userIds);
            if (error) throw error;

            res.json({ success: true, message: 'Đã thực hiện thao tác' });
        } catch (error) {
            console.error('Bulk user action error:', error);
            res.status(500).json({ success: false, error: 'Không thể thực hiện thao tác' });
        }
    }

    // Get vocabulary content for moderation
    async getVocabularyContent(req, res) {
        try {
            const { page = 1, limit = 50, search, listId } = req.query;
            const offset = (page - 1) * limit;

            let query = supabase
                .from('vocabulary_items')
                .select('*, list:vocabulary_lists(name)', { count: 'exact' })
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

            if (search) query = query.ilike('word', `%${search}%`);
            if (listId) query = query.eq('list_id', listId);

            const { data: items, error, count } = await query;
            if (error) throw error;

            res.json({
                success: true,
                data: {
                    items,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total: count,
                        totalPages: Math.ceil(count / limit)
                    }
                }
            });
        } catch (error) {
            console.error('Get vocabulary content error:', error);
            res.status(500).json({ success: false, error: 'Không thể lấy nội dung' });
        }
    }

    // Remove vocabulary item
    async removeVocabulary(req, res) {
        try {
            const { id } = req.params;
            const { error } = await supabase
                .from('vocabulary_items')
                .update({ is_active: false })
                .eq('id', id);

            if (error) throw error;
            res.json({ success: true, message: 'Đã gỡ từ vựng' });
        } catch (error) {
            console.error('Remove vocabulary error:', error);
            res.status(500).json({ success: false, error: 'Không thể gỡ từ vựng' });
        }
    }

    // Send broadcast email to users
    async sendBroadcastEmail(req, res) {
        try {
            const { subject, template, data = {}, filter = {} } = req.body;

            let query = supabase.from('users').select('email, full_name');
            if (filter.role) query = query.eq('role', filter.role);
            if (filter.status) query = query.eq('status', filter.status);

            const { data: users, error } = await query;
            if (error) throw error;

            const recipients = users.map(u => ({ email: u.email, fullName: u.full_name }));
            await emailService.sendBulkEmail({ recipients, subject, template, data });

            res.json({ success: true, message: `Đã gửi email đến ${recipients.length} người dùng` });
        } catch (error) {
            console.error('Send broadcast email error:', error);
            res.status(500).json({ success: false, error: 'Không thể gửi email' });
        }
    }

    // Helper to reuse analytics logic
    async fetchAnalytics(period) {
        const endDate = new Date();
        const startDate = new Date();
        switch (period) {
            case '24h': startDate.setDate(startDate.getDate() - 1); break;
            case '7d': startDate.setDate(startDate.getDate() - 7); break;
            case '30d': startDate.setDate(startDate.getDate() - 30); break;
            case '90d': startDate.setDate(startDate.getDate() - 90); break;
        }

        const { data: userStats } = await supabase
            .rpc('get_user_statistics', { start_date: startDate.toISOString(), end_date: endDate.toISOString() });

        const { count: totalVocabulary } = await supabase
            .from('vocabulary')
            .select('*', { count: 'exact', head: true })
            .eq('is_active', true);

        const { count: totalLists } = await supabase
            .from('vocabulary_lists')
            .select('*', { count: 'exact', head: true });

        const { count: totalClassrooms } = await supabase
            .from('classrooms')
            .select('*', { count: 'exact', head: true })
            .eq('is_active', true);

        const { data: dailyActivity } = await supabase
            .rpc('get_daily_activity', { start_date: startDate.toISOString(), end_date: endDate.toISOString() });

        const { data: performance } = await supabase
            .from('user_stats')
            .select('total_reviews, correct_reviews')
            .gte('updated_at', startDate.toISOString());

        const totalReviews = performance?.reduce((sum, p) => sum + p.total_reviews, 0) || 0;
        const correctReviews = performance?.reduce((sum, p) => sum + p.correct_reviews, 0) || 0;

        return {
            period,
            users: {
                total: userStats?.total_users || 0,
                active: userStats?.active_users || 0,
                new: userStats?.new_users || 0,
                byRole: userStats?.users_by_role || {}
            },
            content: {
                totalVocabulary: totalVocabulary || 0,
                totalLists: totalLists || 0,
                totalClassrooms: totalClassrooms || 0
            },
            activity: {
                totalReviews,
                averageAccuracy: totalReviews > 0 ? Math.round((correctReviews / totalReviews) * 100) : 0,
                dailyActivity: dailyActivity || []
            },
            topMetrics: { mostActiveUsers: [], popularVocabularyLists: [], activeClassrooms: [] }
        };
    }
}

module.exports = new AdminController();