const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
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
    const { classroomId } = req.params;

    // Kiểm tra xem user có quyền truy cập classroom không
    // 1. User là teacher của classroom
    // 2. User là student được join vào classroom
    
    const { data: classroom } = await supabase
      .from('classrooms')
      .select('teacher_id')
      .eq('id', classroomId)
      .single();

    if (!classroom) {
      return res.status(404).json({ 
        success: false, 
        error: 'Classroom not found' 
      });
    }

    // Nếu user là teacher
    if (classroom.teacher_id === userId) {
      return next();
    }

    // Kiểm tra xem user có phải student của classroom không
    const { data: student } = await supabase
      .from('classroom_students')
      .select('id')
      .eq('classroom_id', classroomId)
      .eq('student_id', userId)
      .eq('status', 'active')
      .single();

    if (student) {
      return next();
    }

    // Admin có thể truy cập tất cả
    if (req.user.role === 'admin') {
      return next();
    }

    return res.status(403).json({ 
      success: false, 
      error: 'Access denied' 
    });

  } catch (error) {
    console.error('Classroom access check error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Access check failed' 
    });
  }
};

module.exports = { requireRole, requireOwnership, requireClassroomAccess };