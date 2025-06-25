const supabase = require('../config/database');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

class UserController {
    // Check if email is available for registration
    async checkEmailAvailability(req, res) {
        try {
            const { email } = req.params;

            const { data: user, error } = await supabase
                .from('users')
                .select('id')
                .eq('email', email)
                .single();

            if (error && error.code !== 'PGRST116') throw error;

            res.json({
                success: true,
                data: { available: !user }
            });
        } catch (error) {
            console.error('Check email availability error:', error);
            res.status(500).json({
                success: false,
                error: 'Không thể kiểm tra email'
            });
        }
    }
    // Get user profile
    async getProfile(req, res) {
        try {
            const userId = req.user.id;
            
            const { data: user, error } = await supabase
                .from('users')
                .select(`
                    id,
                    email,
                    full_name,
                    avatar_url,
                    role,
                    created_at,
                    settings:user_settings(*),
                    stats:user_stats(*)
                `)
                .eq('id', userId)
                .single();
                
            if (error) throw error;
            
            res.json({
                success: true,
                data: {
                    ...user,
                    settings: user.settings?.[0] || {},
                    stats: user.stats?.[0] || {}
                }
            });
            
        } catch (error) {
            console.error('Get profile error:', error);
            res.status(500).json({
                success: false,
                error: 'Không thể lấy thông tin người dùng'
            });
        }
    }
    
    // USC12: Update profile
    async updateProfile(req, res) {
        try {
            const userId = req.user.id;
            const { fullName, avatarUrl } = req.body;
            
            const updates = {};
            if (fullName !== undefined) updates.full_name = fullName;
            if (avatarUrl !== undefined) updates.avatar_url = avatarUrl;
            
            const { data: user, error } = await supabase
                .from('users')
                .update({
                    ...updates,
                    updated_at: new Date()
                })
                .eq('id', userId)
                .select()
                .single();
                
            if (error) throw error;
            
            res.json({
                success: true,
                data: user,
                message: 'Cập nhật thông tin thành công'
            });
            
        } catch (error) {
            console.error('Update profile error:', error);
            res.status(500).json({
                success: false,
                error: 'Không thể cập nhật thông tin'
            });
        }
    }
    
    // Update user settings
    async updateSettings(req, res) {
        try {
            const userId = req.user.id;
            const {
                dailyGoal,
                notificationEmail,
                notificationPush,
                timezone,
                language,
                theme
            } = req.body;
            
            const settings = {};
            if (dailyGoal !== undefined) settings.daily_goal = dailyGoal;
            if (notificationEmail !== undefined) settings.notification_email = notificationEmail;
            if (notificationPush !== undefined) settings.notification_push = notificationPush;
            if (timezone !== undefined) settings.timezone = timezone;
            if (language !== undefined) settings.language = language;
            if (theme !== undefined) settings.theme = theme;
            
            const { error } = await supabase
                .from('user_settings')
                .upsert({
                    user_id: userId,
                    ...settings,
                    updated_at: new Date()
                });
                
            if (error) throw error;
            
            res.json({
                success: true,
                message: 'Cập nhật cài đặt thành công'
            });
            
        } catch (error) {
            console.error('Update settings error:', error);
            res.status(500).json({
                success: false,
                error: 'Không thể cập nhật cài đặt'
            });
        }
    }

    // Get user settings
    async getSettings(req, res) {
        try {
            const userId = req.user.id;

            const { data: settings, error } = await supabase
                .from('user_settings')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (error && error.code !== 'PGRST116') throw error;

            res.json({
                success: true,
                data: settings || {}
            });

        } catch (error) {
            console.error('Get settings error:', error);
            res.status(500).json({
                success: false,
                error: 'Không thể lấy cài đặt'
            });
        }
    }
    
    // Change password
    async changePassword(req, res) {
        try {
            const userId = req.user.id;
            const { currentPassword, newPassword } = req.body;
            
            // Get user's current password hash
            const { data: user, error: userError } = await supabase
                .from('users')
                .select('password')
                .eq('id', userId)
                .single();
                
            if (userError || !user) {
                return res.status(404).json({
                    success: false,
                    error: 'Người dùng không tồn tại'
                });
            }
            
            // Verify current password
            const isValid = await bcrypt.compare(currentPassword, user.password);
            if (!isValid) {
                return res.status(401).json({
                    success: false,
                    error: 'Mật khẩu hiện tại không đúng'
                });
            }
            
            // Hash new password
            const hashedPassword = await bcrypt.hash(newPassword, 10);
            
            // Update password
            const { error: updateError } = await supabase
                .from('users')
                .update({
                    password: hashedPassword,
                    updated_at: new Date()
                })
                .eq('id', userId);
                
            if (updateError) throw updateError;
            
            res.json({
                success: true,
                message: 'Đổi mật khẩu thành công'
            });
            
        } catch (error) {
            console.error('Change password error:', error);
            res.status(500).json({
                success: false,
                error: 'Không thể đổi mật khẩu'
            });
        }
    }
    
    // USC22: Report Content
    async reportContent(req, res) {
        try {
            const reporterId = req.user.id;
            const { contentType, contentId, reason, description } = req.body;
            
            // Validate content exists
            const { data: content, error: contentError } = await supabase
                .from(contentType)
                .select('id')
                .eq('id', contentId)
                .single();
                
            if (contentError || !content) {
                return res.status(404).json({
                    success: false,
                    error: 'Nội dung không tồn tại'
                });
            }
            
            // Check if already reported by this user
            const { data: existing } = await supabase
                .from('content_reports')
                .select('id')
                .eq('reporter_id', reporterId)
                .eq('content_id', contentId)
                .eq('content_type', contentType)
                .eq('status', 'pending')
                .single();
                
            if (existing) {
                return res.status(400).json({
                    success: false,
                    error: 'Bạn đã báo cáo nội dung này rồi'
                });
            }
            
            // Create report
            const { error: reportError } = await supabase
                .from('content_reports')
                .insert({
                    reporter_id: reporterId,
                    content_type: contentType,
                    content_id: contentId,
                    reason: reason,
                    description: description,
                    status: 'pending'
                });
                
            if (reportError) throw reportError;
            
            // Notify admins
            const { data: admins } = await supabase
                .from('users')
                .select('id')
                .eq('role', 'admin');
                
            if (admins && admins.length > 0) {
                const notifications = admins.map(admin => ({
                    user_id: admin.id,
                    title: 'Báo cáo nội dung mới',
                    message: `Có báo cáo mới về ${contentType}`,
                    type: 'report',
                    action_url: '/admin/reports'
                }));
                
                await supabase
                    .from('notifications')
                    .insert(notifications);
            }
            
            res.json({
                success: true,
                message: 'Báo cáo đã được gửi thành công'
            });
            
        } catch (error) {
            console.error('Report content error:', error);
            res.status(500).json({
                success: false,
                error: 'Không thể gửi báo cáo'
            });
        }
    }
    
    // Get user's notifications
    async getNotifications(req, res) {
        try {
            const userId = req.user.id;
            const { page = 1, limit = 20, unreadOnly = false } = req.query;
            const offset = (page - 1) * limit;
            
            let query = supabase
                .from('notifications')
                .select('*', { count: 'exact' })
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);
                
            if (unreadOnly === 'true') {
                query = query.eq('is_read', false);
            }
            
            const { data: notifications, error, count } = await query;
            
            if (error) throw error;
            
            res.json({
                success: true,
                data: {
                    notifications: notifications,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total: count,
                        totalPages: Math.ceil(count / limit)
                    }
                }
            });
            
        } catch (error) {
            console.error('Get notifications error:', error);
            res.status(500).json({
                success: false,
                error: 'Không thể lấy thông báo'
            });
        }
    }
    
    // Mark notifications as read
    async markNotificationsRead(req, res) {
        try {
            const userId = req.user.id;
            const { notificationIds } = req.body;
            
            const { error } = await supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('user_id', userId)
                .in('id', notificationIds);
                
            if (error) throw error;
            
            res.json({
                success: true,
                message: 'Đã đánh dấu đã đọc'
            });
            
        } catch (error) {
            console.error('Mark notifications read error:', error);
            res.status(500).json({
                success: false,
                error: 'Không thể cập nhật thông báo'
            });
        }
    }

    // Delete a notification
    async deleteNotification(req, res) {
        try {
            const userId = req.user.id;
            const { id } = req.params;

            const { error } = await supabase
                .from('notifications')
                .delete()
                .eq('user_id', userId)
                .eq('id', id);

            if (error) throw error;

            res.json({
                success: true,
                message: 'Đã xóa thông báo'
            });

        } catch (error) {
            console.error('Delete notification error:', error);
            res.status(500).json({
                success: false,
                error: 'Không thể xóa thông báo'
            });
        }
    }
    
    // Delete account (soft delete)
    async deleteAccount(req, res) {
        try {
            const userId = req.user.id;
            const { password, reason } = req.body;
            
            // Verify password
            const { data: user, error: userError } = await supabase
                .from('users')
                .select('password')
                .eq('id', userId)
                .single();
                
            if (userError || !user) {
                return res.status(404).json({
                    success: false,
                    error: 'Người dùng không tồn tại'
                });
            }
            
            const isValid = await bcrypt.compare(password, user.password);
            if (!isValid) {
                return res.status(401).json({
                    success: false,
                    error: 'Mật khẩu không đúng'
                });
            }
            
            // Soft delete - deactivate account
            const { error: updateError } = await supabase
                .from('users')
                .update({
                    status: 'inactive',
                    deactivated_at: new Date(),
                    deactivation_reason: reason,
                    email: `deleted_${uuidv4()}@vocaboost.com` // Prevent email reuse
                })
                .eq('id', userId);
                
            if (updateError) throw updateError;
            
            res.json({
                success: true,
                message: 'Tài khoản đã được xóa'
            });
            
        } catch (error) {
            console.error('Delete account error:', error);
            res.status(500).json({
                success: false,
                error: 'Không thể xóa tài khoản'
            });
        }
    }

    // Get learning history of the user
    async getLearningHistory(req, res) {
        try {
            const userId = req.user.id;
            const { page = 1, limit = 50 } = req.query;
            const offset = (page - 1) * limit;

            const { data: history, error, count } = await supabase
                .from('review_history')
                .select('*, vocabulary:vocabulary(id, word, definition)', { count: 'exact' })
                .eq('user_id', userId)
                .order('reviewed_at', { ascending: false })
                .range(offset, offset + limit - 1);

            if (error) throw error;

            res.json({
                success: true,
                data: {
                    history: history || [],
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total: count,
                        totalPages: Math.ceil(count / limit)
                    }
                }
            });

        } catch (error) {
            console.error('Get learning history error:', error);
            res.status(500).json({
                success: false,
                error: 'Không thể lấy lịch sử học tập'
            });
        }
    }

    // Get user's achievements
    async getAchievements(req, res) {
        try {
            const userId = req.user.id;

            const { data: achievements, error } = await supabase
                .from('user_achievements')
                .select('*, achievement:achievements(title, description, icon)')
                .eq('user_id', userId)
                .order('achieved_at', { ascending: false });

            if (error) throw error;

            res.json({
                success: true,
                data: achievements || []
            });

        } catch (error) {
            console.error('Get achievements error:', error);
            res.status(500).json({
                success: false,
                error: 'Không thể lấy thành tích'
            });
        }
    }

    // Request a data export for the user
    async requestDataExport(req, res) {
        try {
            const userId = req.user.id;

            const { error } = await supabase
                .from('data_export_requests')
                .insert({
                    user_id: userId,
                    status: 'pending',
                    requested_at: new Date()
                });

            if (error) throw error;

            res.json({
                success: true,
                message: 'Yêu cầu xuất dữ liệu đã được ghi nhận'
            });

        } catch (error) {
            console.error('Request data export error:', error);
            res.status(500).json({
                success: false,
                error: 'Không thể yêu cầu xuất dữ liệu'
            });
        }
    }
}

module.exports = new UserController();