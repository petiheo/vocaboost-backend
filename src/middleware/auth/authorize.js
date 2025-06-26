const Classroom = require('../../models/Classroom');

const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false,
        error: 'Authentication required' 
      });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false,
        error: 'Forbidden', 
        message: 'Insufficient permissions' 
      });
    }
    
    next();
  };
};

const requireOwnership = (resourceKey = 'userId') => {
  return (req, res, next) => {
    const resourceUserId = req.params[resourceKey] || req.body[resourceKey];
    
    if (req.user.role === 'admin') {
      return next(); // Admin can access everything
    }
    
    if (req.user.id !== resourceUserId) {
      return res.status(403).json({ 
        success: false,
        error: 'Forbidden', 
        message: 'You can only access your own resources' 
      });
    }
    
    next();
  };
};

const requireClassroomAccess = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const { classroomId } = req.params;

    // Validate classroomId
    if (!classroomId) {
      return res.status(400).json({
        success: false,
        error: 'Classroom ID is required'
      });
    }

    // Use Classroom model to check access
    const accessInfo = await Classroom.checkUserAccess(userId, classroomId, userRole);

    // Handle classroom not found
    if (!accessInfo.exists) {
      return res.status(404).json({ 
        success: false, 
        error: 'Classroom not found' 
      });
    }

    // Handle no access
    if (!accessInfo.hasAccess) {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied',
        message: 'You do not have permission to access this classroom'
      });
    }

    // Attach access info to request for use in controllers
    req.classroomAccess = {
      type: accessInfo.accessType,
      isTeacher: accessInfo.accessType === 'teacher',
      isLearner: accessInfo.accessType === 'learner',
      isAdmin: accessInfo.accessType === 'admin'
    };

    next();

  } catch (error) {
    console.error('Classroom access middleware error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Access check failed',
      message: 'Unable to verify classroom access'
    });
  }
};

// Additional helper middleware for teacher-only actions
const requireClassroomTeacher = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { classroomId } = req.params;

    // Validate classroomId
    if (!classroomId) {
      return res.status(400).json({
        success: false,
        error: 'Classroom ID is required'
      });
    }

    // Admin can perform teacher actions
    if (req.user.role === 'admin') {
      return next();
    }

    // Check if user is teacher of this classroom
    const isTeacher = await Classroom.isTeacher(classroomId, userId);
    
    if (!isTeacher) {
      // Check if classroom exists for better error message
      const exists = await Classroom.exists(classroomId);
      
      if (!exists) {
        return res.status(404).json({
          success: false,
          error: 'Classroom not found'
        });
      }

      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Only classroom teachers can perform this action'
      });
    }

    // Attach role info
    req.classroomAccess = {
      type: 'teacher',
      isTeacher: true,
      isLearner: false,
      isAdmin: false
    };

    next();

  } catch (error) {
    console.error('Classroom teacher check error:', error);
    return res.status(500).json({
      success: false,
      error: 'Authorization check failed'
    });
  }
};

module.exports = { 
  requireRole, 
  requireOwnership, 
  requireClassroomAccess,
  requireClassroomTeacher 
};