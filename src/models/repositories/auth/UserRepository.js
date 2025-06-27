// models/repositories/auth/UserRepository.js
const BaseRepository = require('../base/BaseRepository');
const bcrypt = require('bcryptjs');

class UserRepository extends BaseRepository {
    constructor() {
        super('users');
    }

    // Authentication-specific methods
    async findByEmail(email) {
        return await this.findOne({ email: email.toLowerCase() });
    }

    async isEmailAvailable(email) {
        const user = await this.findByEmail(email);
        return !user;
    }

    async createUser(userData) {
        // Set default status based on role
        if (userData.role === 'teacher' && !userData.status) {
            userData.status = 'pending';
        } else if (!userData.status) {
            userData.status = 'active';
        }

        // Normalize email
        userData.email = userData.email.toLowerCase();
        
        // Set timestamps
        userData.created_at = new Date();
        userData.updated_at = new Date();

        return await this.create(userData);
    }

    async hashPassword(password) {
        return await bcrypt.hash(password, 10);
    }

    async validatePassword(password, hash) {
        return await bcrypt.compare(password, hash);
    }

    async updateLastLogin(userId) {
        return await this.update(userId, { 
            last_login: new Date() 
        });
    }

    // Profile management
    async getProfile(userId) {
        return await this.findWithRelations(userId, [
            { table: 'user_settings', select: '*' },
            { table: 'user_stats', select: '*' }
        ]);
    }

    async updateProfile(userId, profileData) {
        const allowedFields = ['full_name', 'avatar_url'];
        const updates = {};
        
        allowedFields.forEach(field => {
            if (profileData[field] !== undefined) {
                updates[field] = profileData[field];
            }
        });

        return await this.update(userId, updates);
    }

    // Settings management
    async getUserSettings(userId) {
        const { data, error } = await this.supabase
            .from('user_settings')
            .select('*')
            .eq('user_id', userId)
            .single();
            
        if (error && error.code !== 'PGRST116') throw error;
        return data || this.getDefaultSettings();
    }

    async updateUserSettings(userId, settingsData) {
        const allowedSettings = [
            'daily_goal', 'notification_email', 'notification_push',
            'timezone', 'language', 'theme'
        ];
        
        const updates = {};
        allowedSettings.forEach(field => {
            if (settingsData[field] !== undefined) {
                updates[field] = settingsData[field];
            }
        });

        updates.updated_at = new Date();

        const { data, error } = await this.supabase
            .from('user_settings')
            .upsert({
                user_id: userId,
                ...updates
            })
            .select()
            .single();
            
        if (error) throw error;
        return data;
    }

    getDefaultSettings() {
        return {
            daily_goal: 10,
            notification_email: true,
            notification_push: true,
            timezone: 'Asia/Ho_Chi_Minh',
            language: 'vi',
            theme: 'light'
        };
    }

    // Password management
    async changePassword(userId, currentPassword, newPassword) {
        const user = await this.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        const isValid = await this.validatePassword(currentPassword, user.password_hash);
        if (!isValid) {
            throw new Error('Current password is incorrect');
        }

        const hashedPassword = await this.hashPassword(newPassword);
        return await this.update(userId, { 
            password_hash: hashedPassword 
        });
    }

    // Notifications
    async getUserNotifications(userId, page = 1, limit = 20) {
        const offset = (page - 1) * limit;
        
        const { data, error, count } = await this.supabase
            .from('notifications')
            .select('*', { count: 'exact' })
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);
            
        if (error) throw error;
        
        return {
            notifications: data || [],
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: count,
                totalPages: Math.ceil(count / limit)
            }
        };
    }

    async markNotificationsRead(userId, notificationIds) {
        const { error } = await this.supabase
            .from('notifications')
            .update({ 
                is_read: true, 
                read_at: new Date() 
            })
            .eq('user_id', userId)
            .in('id', notificationIds);
            
        if (error) throw error;
        return true;
    }

    async deleteNotification(userId, notificationId) {
        const { error } = await this.supabase
            .from('notifications')
            .delete()
            .eq('user_id', userId)
            .eq('id', notificationId);
            
        if (error) throw error;
        return true;
    }

    // Content reporting
    async reportContent(reporterId, contentType, contentId, reason, description) {
        const { data, error } = await this.supabase
            .from('content_reports')
            .insert({
                reporter_id: reporterId,
                content_type: contentType,
                content_id: contentId,
                reason: reason,
                description: description || '',
                status: 'pending',
                created_at: new Date()
            })
            .select()
            .single();
            
        if (error) throw error;
        return data;
    }

    // Account management
    async deactivateAccount(userId, password, reason) {
        // Verify password first
        const user = await this.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        const isValid = await this.validatePassword(password, user.password_hash);
        if (!isValid) {
            throw new Error('Password is incorrect');
        }

        // Soft delete - mark as deactivated
        return await this.update(userId, {
            status: 'inactive',
            deactivated_at: new Date(),
            deactivation_reason: reason || 'User requested deletion'
        });
    }

    // Admin functions
    async getAllUsersWithPagination(page = 1, limit = 20, filters = {}) {
        const offset = (page - 1) * limit;
        let query = this.supabase
            .from('users')
            .select('id, email, full_name, role, status, created_at', { count: 'exact' });
            
        // Apply filters
        if (filters.role) query = query.eq('role', filters.role);
        if (filters.status) query = query.eq('status', filters.status);
        if (filters.search) {
            query = query.or(`full_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`);
        }
        
        query = query
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);
            
        const { data, error, count } = await query;
        
        if (error) throw error;
        
        return {
            users: data || [],
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: count,
                totalPages: Math.ceil(count / limit)
            }
        };
    }

    async bulkUpdateUsers(userIds, updates) {
        updates.updated_at = new Date();
        
        const { data, error } = await this.supabase
            .from('users')
            .update(updates)
            .in('id', userIds)
            .select();
            
        if (error) throw error;
        return data;
    }

    async bulkDeleteUsers(userIds) {
        const { error } = await this.supabase
            .from('users')
            .delete()
            .in('id', userIds);
            
        if (error) throw error;
        return true;
    }

    // Statistics
    async getUserStats(userId) {
        const { data, error } = await this.supabase
            .from('user_stats')
            .select('*')
            .eq('user_id', userId)
            .single();
            
        if (error && error.code !== 'PGRST116') throw error;
        return data;
    }

    async updateUserStats(userId, stats) {
        const { data, error } = await this.supabase
            .from('user_stats')
            .upsert({
                user_id: userId,
                ...stats,
                updated_at: new Date()
            })
            .select()
            .single();
            
        if (error) throw error;
        return data;
    }
}

module.exports = UserRepository;