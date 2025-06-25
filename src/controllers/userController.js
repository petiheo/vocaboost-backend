// controllers/userController.js
const User = require('../models/User'); // ✅ Import User Model

class UserController {
    
    // Public endpoint: Check email availability for registration
    async checkEmailAvailability(req, res) {
        try {
            const { email } = req.params;
            
            // ✅ Use Model Layer: Check email availability
            const isAvailable = await User.isEmailAvailable(email);
            
            res.json({
                success: true,
                data: { available: isAvailable }
            });
            
        } catch (error) {
            console.error('Check email availability error:', error);
            res.status(500).json({
                success: false,
                error: 'Không thể kiểm tra email'
            });
        }
    }
    
    // USC11: Get user profile
    async getProfile(req, res) {
        try {
            const userId = req.user.id;
            
            // ✅ Use Model Layer: Get profile with settings and stats
            const profile = await User.getProfile(userId);
            
            res.json({
                success: true,
                data: profile
            });
            
        } catch (error) {
            console.error('Get profile error:', error);
            res.status(500).json({
                success: false,
                error: 'Không thể lấy thông tin người dùng'
            });
        }
    }
    
    // USC12: Update user profile
    async updateProfile(req, res) {
        try {
            const userId = req.user.id;
            const { fullName, avatarUrl } = req.body;
            
            // ✅ Use Model Layer: Update profile with validation
            const updatedUser = await User.updateProfile(userId, {
                full_name: fullName,
                avatar_url: avatarUrl
            });
            
            res.json({
                success: true,
                data: updatedUser,
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
    
    // USC13: Get user settings
    async getSettings(req, res) {
        try {
            const userId = req.user.id;
            
            // ✅ Use Model Layer: Get user settings
            const settings = await User.getSettings(userId);
            
            res.json({
                success: true,
                data: settings
            });
            
        } catch (error) {
            console.error('Get settings error:', error);
            res.status(500).json({
                success: false,
                error: 'Không thể lấy cài đặt'
            });
        }
    }
    
    // USC14: Update user settings
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
            
            // ✅ Use Model Layer: Update settings with validation
            const updatedSettings = await User.updateSettings(userId, {
                daily_goal: dailyGoal,
                notification_email: notificationEmail,
                notification_push: notificationPush,
                timezone,
                language,
                theme
            });
            
            res.json({
                success: true,
                data: updatedSettings,
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
    
    // USC15: Change password
    async changePassword(req, res) {
        try {
            const userId = req.user.id;
            const { currentPassword, newPassword } = req.body;
            
            // ✅ Use Model Layer: Change password with validation
            await User.changePassword(userId, currentPassword, newPassword);
            
            res.json({
                success: true,
                message: 'Đổi mật khẩu thành công'
            });
            
        } catch (error) {
            console.error('Change password error:', error);
            
            // Handle specific error messages
            let errorMessage = 'Không thể đổi mật khẩu';
            if (error.message === 'User not found') {
                errorMessage = 'Người dùng không tồn tại';
            } else if (error.message === 'Current password is incorrect') {
                errorMessage = 'Mật khẩu hiện tại không đúng';
            }
            
            res.status(400).json({
                success: false,
                error: errorMessage
            });
        }
    }
    
    // USC22: Report content
    async reportContent(req, res) {
        try {
            const reporterId = req.user.id;
            const { contentType, contentId, reason, description } = req.body;
            
            // ✅ Use Model Layer: Report content
            const report = await User.reportContent(
                reporterId, 
                contentType, 
                contentId, 
                reason, 
                description
            );
            
            res.json({
                success: true,
                data: report,
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
    
    // USC16: Get notifications
    async getNotifications(req, res) {
        try {
            const userId = req.user.id;
            const { page = 1, limit = 20 } = req.query;
            
            // ✅ Use Model Layer: Get notifications with pagination
            const result = await User.getNotifications(userId, page, limit);
            
            res.json({
                success: true,
                data: result
            });
            
        } catch (error) {
            console.error('Get notifications error:', error);
            res.status(500).json({
                success: false,
                error: 'Không thể lấy thông báo'
            });
        }
    }
    
    // USC17: Mark notifications as read
    async markNotificationsRead(req, res) {
        try {
            const userId = req.user.id;
            const { notificationIds } = req.body;
            
            // ✅ Use Model Layer: Mark notifications as read
            await User.markNotificationsRead(userId, notificationIds);
            
            res.json({
                success: true,
                message: 'Đã đánh dấu thông báo là đã đọc'
            });
            
        } catch (error) {
            console.error('Mark notifications read error:', error);
            res.status(500).json({
                success: false,
                error: 'Không thể cập nhật thông báo'
            });
        }
    }
    
    // USC18: Delete notification
    async deleteNotification(req, res) {
        try {
            const userId = req.user.id;
            const { id } = req.params;
            
            // ✅ Use Model Layer: Delete notification
            await User.deleteNotification(userId, id);
            
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
    
    // USC19: Delete account
    async deleteAccount(req, res) {
        try {
            const userId = req.user.id;
            const { password, reason } = req.body;
            
            // ✅ Use Model Layer: Delete account with verification
            await User.deleteAccount(userId, password, reason);
            
            res.json({
                success: true,
                message: 'Tài khoản đã được vô hiệu hóa'
            });
            
        } catch (error) {
            console.error('Delete account error:', error);
            
            // Handle specific error messages
            let errorMessage = 'Không thể xóa tài khoản';
            if (error.message === 'User not found') {
                errorMessage = 'Người dùng không tồn tại';
            } else if (error.message === 'Password is incorrect') {
                errorMessage = 'Mật khẩu không đúng';
            }
            
            res.status(400).json({
                success: false,
                error: errorMessage
            });
        }
    }
    
    // USC20: Get learning history
    async getLearningHistory(req, res) {
        try {
            const userId = req.user.id;
            const { page = 1, limit = 20 } = req.query;
            
            // ✅ Use Model Layer: Get learning history
            const result = await User.getLearningHistory(userId, page, limit);
            
            res.json({
                success: true,
                data: result
            });
            
        } catch (error) {
            console.error('Get learning history error:', error);
            res.status(500).json({
                success: false,
                error: 'Không thể lấy lịch sử học tập'
            });
        }
    }
    
    // USC21: Get achievements
    async getAchievements(req, res) {
        try {
            const userId = req.user.id;
            
            // ✅ Use Model Layer: Get user achievements
            const achievements = await User.getAchievements(userId);
            
            res.json({
                success: true,
                data: achievements
            });
            
        } catch (error) {
            console.error('Get achievements error:', error);
            res.status(500).json({
                success: false,
                error: 'Không thể lấy thành tích'
            });
        }
    }
    
    // USC23: Request data export
    async requestDataExport(req, res) {
        try {
            const userId = req.user.id;
            
            // ✅ Use Model Layer: Request data export
            const exportRequest = await User.requestDataExport(userId);
            
            res.json({
                success: true,
                data: exportRequest,
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