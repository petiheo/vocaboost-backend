// models/User.js
const supabase = require('../config/database');
const bcrypt = require('bcryptjs');

class User {
    // Basic CRUD operations
    static async findById(id) {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', id)
            .single();
            
        if (error && error.code !== 'PGRST116') throw error;
        return data;
    }
    
    static async findByEmail(email) {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();
            
        if (error && error.code !== 'PGRST116') throw error;
        return data;
    }
    
    static async create(userData) {
        // Business logic: Set status based on role
        if (userData.role === 'teacher' && !userData.status) {
            userData.status = 'pending'; // Teachers need approval
        } else if (!userData.status) {
            userData.status = 'active'; // Default for learners
        }
        
        // Auto-generate timestamps
        userData.created_at = new Date();
        userData.updated_at = new Date();
        
        const { data, error } = await supabase
            .from('users')
            .insert(userData)
            .select()
            .single();
            
        if (error) throw error;
        return data;
    }
    
    static async update(id, updates) {
        updates.updated_at = new Date();
        
        const { data, error } = await supabase
            .from('users')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
            
        if (error) throw error;
        return data;
    }
    
    static async delete(id) {
        const { error } = await supabase
            .from('users')
            .delete()
            .eq('id', id);
            
        if (error) throw error;
        return true;
    }
    
    // Authentication-related methods
    static async validatePassword(plainPassword, hashedPassword) {
        return await bcrypt.compare(plainPassword, hashedPassword);
    }
    
    static async hashPassword(plainPassword) {
        return await bcrypt.hash(plainPassword, 10);
    }
    
    static async updateLastLogin(id) {
        return await this.update(id, { last_login: new Date() });
    }
    
    static async isEmailAvailable(email) {
        const user = await this.findByEmail(email);
        return !user;
    }
    
    // Profile and settings methods
    static async getProfile(id) {
        const { data, error } = await supabase
            .from('users')
            .select(`
                id,
                email,
                full_name,
                avatar_url,
                role,
                status,
                created_at,
                settings:user_settings(*),
                stats:user_stats(*)
            `)
            .eq('id', id)
            .single();
            
        if (error) throw error;
        
        return {
            ...data,
            settings: data.settings?.[0] || {},
            stats: data.stats?.[0] || {}
        };
    }
    
    static async updateProfile(id, profileData) {
        const allowedFields = ['full_name', 'avatar_url'];
        const updates = {};
        
        allowedFields.forEach(field => {
            if (profileData[field] !== undefined) {
                updates[field] = profileData[field];
            }
        });
        
        return await this.update(id, updates);
    }
    
    // Settings management
    static async getSettings(userId) {
        const { data, error } = await supabase
            .from('user_settings')
            .select('*')
            .eq('user_id', userId)
            .single();
            
        if (error && error.code !== 'PGRST116') throw error;
        return data || this.getDefaultSettings();
    }
    
    static async updateSettings(userId, settingsData) {
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
        
        const { data, error } = await supabase
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
    
    static getDefaultSettings() {
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
    static async changePassword(userId, currentPassword, newPassword) {
        // Get current user
        const user = await this.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }
        
        // Verify current password
        const isValidPassword = await this.validatePassword(currentPassword, user.password_hash);
        if (!isValidPassword) {
            throw new Error('Current password is incorrect');
        }
        
        // Hash new password
        const hashedNewPassword = await this.hashPassword(newPassword);
        
        // Update password
        return await this.update(userId, { 
            password_hash: hashedNewPassword 
        });
    }
    
    // Content reporting
    static async reportContent(reporterId, contentType, contentId, reason, description) {
        const { data, error } = await supabase
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
    
    // Notifications
    static async getNotifications(userId, page = 1, limit = 20) {
        const offset = (page - 1) * limit;
        
        const { data, error, count } = await supabase
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
    
    static async markNotificationsRead(userId, notificationIds) {
        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true, read_at: new Date() })
            .eq('user_id', userId)
            .in('id', notificationIds);
            
        if (error) throw error;
        return true;
    }
    
    static async deleteNotification(userId, notificationId) {
        const { error } = await supabase
            .from('notifications')
            .delete()
            .eq('user_id', userId)
            .eq('id', notificationId);
            
        if (error) throw error;
        return true;
    }
    
    // Learning history and achievements
    static async getLearningHistory(userId, page = 1, limit = 20) {
        const offset = (page - 1) * limit;
        
        const { data, error, count } = await supabase
            .from('learning_sessions')
            .select(`
                *,
                vocabulary_list:vocabulary_lists(name)
            `, { count: 'exact' })
            .eq('user_id', userId)
            .order('session_date', { ascending: false })
            .range(offset, offset + limit - 1);
            
        if (error) throw error;
        
        return {
            history: data || [],
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: count,
                totalPages: Math.ceil(count / limit)
            }
        };
    }
    
    static async getAchievements(userId) {
        const { data, error } = await supabase
            .from('user_achievements')
            .select('*, achievement:achievements(title, description, icon)')
            .eq('user_id', userId)
            .order('achieved_at', { ascending: false });
            
        if (error) throw error;
        return data || [];
    }
    
    // Account management
    static async deleteAccount(userId, password, reason) {
        // Verify password before deletion
        const user = await this.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }
        
        const isValidPassword = await this.validatePassword(password, user.password_hash);
        if (!isValidPassword) {
            throw new Error('Password is incorrect');
        }
        
        // Soft delete - mark as deactivated
        return await this.update(userId, {
            status: 'inactive',
            deactivated_at: new Date(),
            deactivation_reason: reason || 'User requested deletion'
        });
    }
    
    static async requestDataExport(userId) {
        const { data, error } = await supabase
            .from('data_export_requests')
            .insert({
                user_id: userId,
                status: 'pending',
                requested_at: new Date()
            })
            .select()
            .single();
            
        if (error) throw error;
        return data;
    }
    
    
    // Admin functions
    static async getAllUsers(page = 1, limit = 20, filters = {}) {
        const offset = (page - 1) * limit;
        let query = supabase
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
    
    static async bulkUpdateUsers(userIds, updates) {
        updates.updated_at = new Date();
        
        const { data, error } = await supabase
            .from('users')
            .update(updates)
            .in('id', userIds)
            .select();
            
        if (error) throw error;
        return data;
    }
    
    static async bulkDeleteUsers(userIds) {
        const { error } = await supabase
            .from('users')
            .delete()
            .in('id', userIds);
            
        if (error) throw error;
        return true;
    }
}

module.exports = User;