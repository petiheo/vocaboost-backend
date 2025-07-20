const teacherService = require('../services/teacher.service');
const storageService = require('../services/storage.service');

class TeacherController {
  async submitVerification(req, res) {
    try {
      const userId = req.user.userId;
      const { fullName, institution, schoolEmail, additionalNotes } = req.body;
      const file = req.file;

      // Check if user can submit request
      const canSubmit = await teacherService.canSubmitRequest(userId);
      if (!canSubmit) {
        return res.status(400).json({
          success: false,
          message: 'You cannot submit a new request at this time. Please check your existing request status.'
        });
      }

      // Validate school email if provided
      if (schoolEmail && !teacherService.validateSchoolEmail(schoolEmail)) {
        console.warn(`Non-educational email submitted: ${schoolEmail}`);
      }

      // Validate file if provided
      if (file && !storageService.isValidFileType(file.mimetype)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid file type. Please upload an image (JPEG, PNG) or document (PDF, DOC, DOCX).'
        });
      }

      // Submit verification request
      const verificationRequest = await teacherService.submitVerificationRequest(
        userId,
        {
          fullName,
          institution,
          schoolEmail,
          additionalNotes
        },
        file
      );

      return res.status(201).json({
        success: true,
        message: 'Your teacher verification request has been submitted successfully.',
        data: {
          requestId: verificationRequest.id,
          status: verificationRequest.status,
          submittedAt: verificationRequest.created_at
        }
      });
    } catch (error) {
      console.error('Submit verification error:', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Failed to submit verification request'
      });
    }
  }

  async getVerificationStatus(req, res) {
    try {
      const userId = req.user.userId;
      const status = await teacherService.getVerificationStatus(userId);

      return res.status(200).json({
        success: true,
        data: status
      });
    } catch (error) {
      console.error('Get verification status error:', error);
      return res.status(400).json({
        success: false,
        message: 'Failed to get verification status'
      });
    }
  }

  // Admin endpoints
  async getPendingRequests(req, res) {
    try {
      const { limit = 50 } = req.query;
      const requests = await teacherService.getPendingRequests(parseInt(limit));

      return res.status(200).json({
        success: true,
        data: {
          count: requests.length,
          requests
        }
      });
    } catch (error) {
      console.error('Get pending requests error:', error);
      return res.status(400).json({
        success: false,
        message: 'Failed to get pending requests'
      });
    }
  }

  async getAllRequests(req, res) {
    try {
      const { status, limit = 100 } = req.query;
      const filters = {};

      if (status) filters.status = status;
      if (limit) filters.limit = parseInt(limit);

      const requests = await teacherService.getAllRequests(filters);

      return res.status(200).json({
        success: true,
        data: {
          count: requests.length,
          requests
        }
      });
    } catch (error) {
      console.error('Get all requests error:', error);
      return res.status(400).json({
        success: false,
        message: 'Failed to get requests'
      });
    }
  }

  async approveRequest(req, res) {
    try {
      const { requestId } = req.params;
      const reviewerId = req.user.userId;

      const approvedRequest = await teacherService.approveRequest(
        requestId,
        reviewerId
      );

      return res.status(200).json({
        success: true,
        message: 'Teacher verification request approved successfully',
        data: approvedRequest
      });
    } catch (error) {
      console.error('Approve request error:', error);
      return res.status(400).json({
        success: false,
        message: 'Failed to approve request'
      });
    }
  }

  async rejectRequest(req, res) {
    try {
      const { requestId } = req.params;
      const { rejectionReason } = req.body;
      const reviewerId = req.user.userId;

      if (!rejectionReason) {
        return res.status(400).json({
          success: false,
          message: 'Rejection reason is required'
        });
      }

      const rejectedRequest = await teacherService.rejectRequest(
        requestId,
        reviewerId,
        rejectionReason
      );

      return res.status(200).json({
        success: true,
        message: 'Teacher verification request rejected',
        data: rejectedRequest
      });
    } catch (error) {
      console.error('Reject request error:', error);
      return res.status(400).json({
        success: false,
        message: 'Failed to reject request'
      });
    }
  }
}

module.exports = new TeacherController();