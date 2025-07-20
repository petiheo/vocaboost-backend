const teacherRequestModel = require('../models/teacherRequest.model');
const userModel = require('../models/user.model');
const storageService = require('./storage.service');
const emailService = require('./email.service');

class TeacherService {
  async submitVerificationRequest(userId, data, file) {
    try {
      // Check if user already has a pending request
      const existingRequest = await teacherRequestModel.findByUserId(userId);
      
      if (existingRequest && existingRequest.status === 'pending') {
        throw new Error('You already have a pending verification request');
      }

      if (existingRequest && existingRequest.status === 'approved') {
        throw new Error('Your teacher account has already been verified');
      }

      // Upload credential file
      let credentialsUrl = null;
      if (file) {
        const uploadResult = await storageService.uploadFile(file, userId);
        credentialsUrl = uploadResult.url;
      }

      // Create teacher request
      const teacherRequest = await teacherRequestModel.create({
        userId,
        institution: data.institution,
        credentialsUrl,
        additionalNotes: data.additionalNotes,
      });

      // Update user display name if provided
      if (data.fullName) {
        await userModel.updateDisplayName(userId, data.fullName);
      }

      // Send notification email to admin
      await this.notifyAdminOfNewRequest(teacherRequest);

      return teacherRequest;
    } catch (error) {
      console.error('Submit verification error:', error);
      throw error;
    }
  }

  async getVerificationStatus(userId) {
    try {
      const request = await teacherRequestModel.findByUserId(userId);
      
      if (!request) {
        return {
          status: 'not_submitted',
          message: 'No verification request found'
        };
      }

      return {
        status: request.status,
        submittedAt: request.created_at,
        institution: request.institution,
        rejectionReason: request.rejection_reason,
        message: this.getStatusMessage(request.status)
      };
    } catch (error) {
      console.error('Get verification status error:', error);
      throw error;
    }
  }

  async approveRequest(requestId, reviewerId) {
    try {
      // Update request status
      const request = await teacherRequestModel.updateStatus(
        requestId,
        'approved',
        reviewerId
      );

      // Update user role to teacher
      await userModel.updateRole(request.user_id, 'teacher');

      // Get user details for email
      const user = await userModel.findById(request.user_id);

      // Send approval email
      await emailService.sendTeacherApprovalEmail(
        user.email,
        user.display_name || 'Teacher'
      );

      return request;
    } catch (error) {
      console.error('Approve request error:', error);
      throw error;
    }
  }

  async rejectRequest(requestId, reviewerId, rejectionReason) {
    try {
      // Update request status
      const request = await teacherRequestModel.updateStatus(
        requestId,
        'rejected',
        reviewerId,
        rejectionReason
      );

      // Get user details for email
      const user = await userModel.findById(request.user_id);

      // Send rejection email
      await emailService.sendTeacherRejectionEmail(
        user.email,
        user.display_name || 'User',
        rejectionReason
      );

      return request;
    } catch (error) {
      console.error('Reject request error:', error);
      throw error;
    }
  }

  async getPendingRequests(limit = 50) {
    try {
      return await teacherRequestModel.findAll({
        status: 'pending',
        limit
      });
    } catch (error) {
      console.error('Get pending requests error:', error);
      throw error;
    }
  }

  async getAllRequests(filters = {}) {
    try {
      return await teacherRequestModel.findAll(filters);
    } catch (error) {
      console.error('Get all requests error:', error);
      throw error;
    }
  }

  getStatusMessage(status) {
    const messages = {
      pending: 'Your verification request is being reviewed by our team.',
      approved: 'Congratulations! Your teacher account has been verified.',
      rejected: 'Your verification request was not approved. Please check the reason and resubmit if needed.',
      not_submitted: 'You have not submitted a verification request yet.'
    };
    return messages[status] || 'Unknown status';
  }

  async notifyAdminOfNewRequest(request) {
    // In production, this would send an email or notification to admin
    console.log('New teacher verification request:', request.id);
  }

  // Validate school email domain
  validateSchoolEmail(email) {
    // Common educational domains
    const eduDomains = ['.edu', '.edu.vn', '.ac.uk', '.edu.au', '.edu.sg'];
    const domain = email.toLowerCase();
    
    return eduDomains.some(eduDomain => domain.endsWith(eduDomain));
  }

  // Check if user can submit new request
  async canSubmitRequest(userId) {
    const existingRequest = await teacherRequestModel.findByUserId(userId);
    
    if (!existingRequest) return true;
    
    // Allow resubmission if previous request was rejected
    if (existingRequest.status === 'rejected') {
      // Check if enough time has passed (e.g., 24 hours)
      const daysSinceRejection = (Date.now() - new Date(existingRequest.created_at)) / (1000 * 60 * 60 * 24);
      return daysSinceRejection >= 1;
    }
    
    return existingRequest.status !== 'pending' && existingRequest.status !== 'approved';
  }
}

module.exports = new TeacherService();