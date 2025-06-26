const supabase = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const emailService = require('../services/emailService');

class ClassroomController {
    // USC14: Create classroom
    async createClassroom(req, res) {
        try {
            const teacherId = req.user.id;
            const { name, description, subject, gradeLevel, maxLearners = 50 } = req.body;
            
            // Generate unique class code
            const classCode = await this.generateUniqueClassCode();
            
            // Create classroom
            const { data: classroom, error } = await supabase
                .from('classrooms')
                .insert({
                    name,
                    description,
                    subject,
                    grade_level: gradeLevel,
                    teacher_id: teacherId,
                    class_code: classCode,
                    max_students: maxLearners,
                    is_active: true
                })
                .select()
                .single();
                
            if (error) throw error;
            
            res.status(201).json({
                success: true,
                data: classroom,
                message: 'Lớp học đã được tạo thành công'
            });
            
        } catch (error) {
            console.error('Create classroom error:', error);
            res.status(500).json({
                success: false,
                error: 'Không thể tạo lớp học'
            });
        }
    }
    
    // Get teacher's classrooms
    async getMyClassrooms(req, res) {
        try {
            const teacherId = req.user.id;
            
            const { data: classrooms, error } = await supabase
                .from('classrooms')
                .select(`
                    *,
                    student_count:classroom_students(count)
                `)
                .eq('teacher_id', teacherId)
                .eq('is_active', true)
                .order('created_at', { ascending: false });
                
            if (error) throw error;
            
            // Get assignment counts
            const classroomIds = classrooms.map(c => c.id);
            const { data: assignments } = await supabase
                .from('assignments')
                .select('classroom_id')
                .in('classroom_id', classroomIds)
                .eq('is_active', true);
                
            // Merge assignment counts
            const enhancedClassrooms = classrooms.map(classroom => ({
                ...classroom,
                student_count: classroom.student_count[0]?.count || 0,
                assignment_count: assignments?.filter(a => a.classroom_id === classroom.id).length || 0
            }));
            
            res.json({
                success: true,
                data: enhancedClassrooms
            });
            
        } catch (error) {
            console.error('Get classrooms error:', error);
            res.status(500).json({
                success: false,
                error: 'Không thể lấy danh sách lớp học'
            });
        }
    }
    
    // USC15: Add/Remove students
    async inviteStudents(req, res) {
        try {
            const teacherId = req.user.id;
            const { classroomId } = req.params;
            const { emails, message } = req.body;
            
            // Verify teacher owns classroom
            const { data: classroom, error: classError } = await supabase
                .from('classrooms')
                .select('*')
                .eq('id', classroomId)
                .eq('teacher_id', teacherId)
                .single();
                
            if (classError || !classroom) {
                return res.status(403).json({
                    success: false,
                    error: 'Không có quyền truy cập lớp học này'
                });
            }
            
            // Check classroom capacity
            const { count: currentLearners } = await supabase
                .from('classroom_students')
                .select('*', { count: 'exact', head: true })
                .eq('classroom_id', classroomId)
                .eq('status', 'active');
                
            if (currentLearners + emails.length > classroom.max_students) {
                return res.status(400).json({
                    success: false,
                    error: `Lớp học chỉ còn ${classroom.max_students - currentLearners} chỗ trống`
                });
            }
            
            // Create invitations
            const invitations = [];
            const emailPromises = [];
            
            for (const email of emails) {
                const inviteCode = uuidv4();
                invitations.push({
                    classroom_id: classroomId,
                    email: email,
                    invite_code: inviteCode,
                    invited_by: teacherId,
                    status: 'pending',
                    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
                });
                
                // Send invitation email
                emailPromises.push(
                    emailService.sendClassroomInvitation({
                        to: email,
                        classroomName: classroom.name,
                        teacherName: req.user.full_name,
                        inviteCode: inviteCode,
                        message: message,
                        classCode: classroom.class_code
                    })
                );
            }
            
            // Insert invitations
            const { error: inviteError } = await supabase
                .from('classroom_invitations')
                .insert(invitations);
                
            if (inviteError) throw inviteError;
            
            // Send emails (don't wait)
            Promise.all(emailPromises).catch(err => 
                console.error('Email sending error:', err)
            );
            
            res.json({
                success: true,
                message: `Đã gửi ${emails.length} lời mời tham gia lớp học`
            });
            
        } catch (error) {
            console.error('Invite students error:', error);
            res.status(500).json({
                success: false,
                error: 'Không thể gửi lời mời'
            });
        }
    }
    
    // Remove students from classroom
    async removeStudents(req, res) {
        try {
            const teacherId = req.user.id;
            const { classroomId } = req.params;
            const { learnerIds } = req.body;
            
            // Verify teacher owns classroom
            const { data: classroom, error: classError } = await supabase
                .from('classrooms')
                .select('id')
                .eq('id', classroomId)
                .eq('teacher_id', teacherId)
                .single();
                
            if (classError || !classroom) {
                return res.status(403).json({
                    success: false,
                    error: 'Không có quyền truy cập lớp học này'
                });
            }
            
            // Update student status
            const { error } = await supabase
                .from('classroom_students')
                .update({ 
                    status: 'removed',
                    left_at: new Date()
                })
                .eq('classroom_id', classroomId)
                .in('student_id', learnerIds);
                
            if (error) throw error;
            
            res.json({
                success: true,
                message: `Đã xóa ${learnerIds.length} học sinh khỏi lớp`
            });
            
        } catch (error) {
            console.error('Remove students error:', error);
            res.status(500).json({
                success: false,
                error: 'Không thể xóa học sinh'
            });
        }
    }
    
    // USC16: Assign exercise
    async createAssignment(req, res) {
        try {
            const teacherId = req.user.id;
            const { classroomId } = req.params;
            const {
                title,
                description,
                assignmentType = 'vocabulary',
                dueDate,
                vocabularyIds = [],
                settings = {}
            } = req.body;
            
            // Verify teacher owns classroom
            const { data: classroom, error: classError } = await supabase
                .from('classrooms')
                .select('id, name')
                .eq('id', classroomId)
                .eq('teacher_id', teacherId)
                .single();
                
            if (classError || !classroom) {
                return res.status(403).json({
                    success: false,
                    error: 'Không có quyền truy cập lớp học này'
                });
            }
            
            // Create assignment
            const { data: assignment, error: assignError } = await supabase
                .from('assignments')
                .insert({
                    classroom_id: classroomId,
                    title,
                    description,
                    assignment_type: assignmentType,
                    due_date: dueDate,
                    settings,
                    created_by: teacherId,
                    is_active: true
                })
                .select()
                .single();
                
            if (assignError) throw assignError;
            
            // Link vocabulary items if provided
            if (vocabularyIds.length > 0) {
                const vocabularyLinks = vocabularyIds.map(vocabId => ({
                    assignment_id: assignment.id,
                    vocabulary_id: vocabId
                }));
                
                await supabase
                    .from('assignment_vocabulary')
                    .insert(vocabularyLinks);
            }
            
            // Create learner assignments for all active learners
            const { data: learners } = await supabase
                .from('classroom_students')
                .select('student_id')
                .eq('classroom_id', classroomId)
                .eq('status', 'active');

            if (learners && learners.length > 0) {
                const learnerAssignments = learners.map(s => ({
                    assignment_id: assignment.id,
                    student_id: s.student_id,
                    status: 'assigned'
                }));

                await supabase
                    .from('student_assignments')
                    .insert(learnerAssignments);

                // Send notifications to learners
                const notifications = learners.map(s => ({
                    user_id: s.student_id,
                    title: 'Bài tập mới',
                    message: `Bạn có bài tập mới "${title}" trong lớp ${classroom.name}`,
                    type: 'assignment',
                    action_url: `/assignments/${assignment.id}`
                }));
                
                await supabase
                    .from('notifications')
                    .insert(notifications);
            }
            
            res.status(201).json({
                success: true,
                data: assignment,
                message: 'Bài tập đã được tạo và giao cho học sinh'
            });
            
        } catch (error) {
            console.error('Create assignment error:', error);
            res.status(500).json({
                success: false,
                error: 'Không thể tạo bài tập'
            });
        }
    }
    
    // USC17: View classroom analytics
    async getClassroomAnalytics(req, res) {
        try {
            const teacherId = req.user.id;
            const { classroomId } = req.params;
            const { period = '30d' } = req.query;
            
            // Verify teacher owns classroom
            const { data: classroom, error: classError } = await supabase
                .from('classrooms')
                .select('*')
                .eq('id', classroomId)
                .eq('teacher_id', teacherId)
                .single();
                
            if (classError || !classroom) {
                return res.status(403).json({
                    success: false,
                    error: 'Không có quyền truy cập lớp học này'
                });
            }
            
            // Get learners in classroom
            const { data: learners } = await supabase
                .from('classroom_students')
                .select(`
                    learner:users(
                        id,
                        full_name,
                        email,
                        stats:user_stats(*)
                    )
                `)
                .eq('classroom_id', classroomId)
                .eq('status', 'active');
                
            // Get assignments
            const { data: assignments } = await supabase
                .from('assignments')
                .select(`
                    *,
                    submissions:student_assignments(
                        student_id,
                        status,
                        score,
                        completed_at
                    )
                `)
                .eq('classroom_id', classroomId);
                
            // Calculate analytics
            const analytics = {
                classroom: {
                    id: classroom.id,
                    name: classroom.name,
                    learnerCount: learners?.length || 0,
                    assignmentCount: assignments?.length || 0
                },
                learners: learners?.map(s => ({
                    id: s.learner.id,
                    name: s.learner.full_name,
                    email: s.learner.email,
                    totalVocabulary: s.learner.stats?.[0]?.total_vocabulary || 0,
                    accuracy: s.learner.stats?.[0]?.correct_reviews
                        ? Math.round((s.learner.stats[0].correct_reviews / s.learner.stats[0].total_reviews) * 100)
                        : 0,
                    streak: s.learner.stats?.[0]?.current_streak || 0
                })) || [],
                assignments: assignments?.map(a => ({
                    id: a.id,
                    title: a.title,
                    dueDate: a.due_date,
                    completionRate: a.submissions.length > 0
                        ? Math.round((a.submissions.filter(s => s.status === 'completed').length / a.submissions.length) * 100)
                        : 0,
                    averageScore: a.submissions.filter(s => s.score !== null).length > 0
                        ? Math.round(
                            a.submissions
                                .filter(s => s.score !== null)
                                .reduce((sum, s) => sum + s.score, 0) / 
                            a.submissions.filter(s => s.score !== null).length
                        )
                        : null
                })) || [],
                summary: {
                    averageAccuracy: 0,
                    averageStreak: 0,
                    totalVocabularyLearned: 0,
                    mostDifficultWords: []
                }
            };
            
            // Calculate summary stats
            if (analytics.learners.length > 0) {
                analytics.summary.averageAccuracy = Math.round(
                    analytics.learners.reduce((sum, s) => sum + s.accuracy, 0) / analytics.learners.length
                );
                analytics.summary.averageStreak = Math.round(
                    analytics.learners.reduce((sum, s) => sum + s.streak, 0) / analytics.learners.length
                );
                analytics.summary.totalVocabularyLearned =
                    analytics.learners.reduce((sum, s) => sum + s.totalVocabulary, 0);
            }
            
            res.json({
                success: true,
                data: analytics
            });
            
        } catch (error) {
            console.error('Get classroom analytics error:', error);
            res.status(500).json({
                success: false,
                error: 'Không thể lấy thống kê lớp học'
            });
        }
    }
    
    // Student join classroom
    async joinClassroom(req, res) {
        try {
            const learnerId = req.user.id;
            const { classCode } = req.body;
            
            // Find classroom by code
            const { data: classroom, error: classError } = await supabase
                .from('classrooms')
                .select('*')
                .eq('class_code', classCode)
                .eq('is_active', true)
                .single();
                
            if (classError || !classroom) {
                return res.status(404).json({
                    success: false,
                    error: 'Mã lớp học không hợp lệ'
                });
            }
            
            // Check if already joined
            const { data: existing } = await supabase
                .from('classroom_students')
                .select('id')
                .eq('classroom_id', classroom.id)
                .eq('student_id', learnerId)
                .single();
                
            if (existing) {
                return res.status(400).json({
                    success: false,
                    error: 'Bạn đã tham gia lớp học này rồi'
                });
            }
            
            // Check capacity
            const { count: currentLearners } = await supabase
                .from('classroom_students')
                .select('*', { count: 'exact', head: true })
                .eq('classroom_id', classroom.id)
                .eq('status', 'active');
                
            if (currentLearners >= classroom.max_students) {
                return res.status(400).json({
                    success: false,
                    error: 'Lớp học đã đầy'
                });
            }
            
            // Join classroom
            const { error: joinError } = await supabase
                .from('classroom_students')
                .insert({
                    classroom_id: classroom.id,
                    student_id: learnerId,
                    status: 'active'
                });
                
            if (joinError) throw joinError;
            
            res.json({
                success: true,
                data: {
                    classroomId: classroom.id,
                    classroomName: classroom.name
                },
                message: 'Tham gia lớp học thành công'
            });
            
        } catch (error) {
            console.error('Join classroom error:', error);
            res.status(500).json({
                success: false,
                error: 'Không thể tham gia lớp học'
            });
        }
    }

    // Get classes of current user (student)
    async getMyClasses(req, res) {
        try {
            const learnerId = req.user.id;

            const { data: classes, error } = await supabase
                .from('classroom_students')
                .select('classroom:classrooms(*)')
                .eq('student_id', learnerId)
                .eq('status', 'active');

            if (error) throw error;

            const result = classes.map(c => c.classroom);

            res.json({ success: true, data: result });
        } catch (error) {
            console.error('Get my classes error:', error);
            res.status(500).json({ success: false, error: 'Không thể lấy lớp học' });
        }
    }

    // Get classroom details for member
    async getClassroomDetails(req, res) {
        try {
            const userId = req.user.id;
            const { classroomId } = req.params;

            const { data: classroom, error: classError } = await supabase
                .from('classrooms')
                .select('*')
                .eq('id', classroomId)
                .single();

            if (classError || !classroom) {
                return res.status(404).json({ success: false, error: 'Lớp học không tồn tại' });
            }

            if (classroom.teacher_id !== userId) {
                const { data: member } = await supabase
                    .from('classroom_students')
                    .select('id')
                    .eq('classroom_id', classroomId)
                    .eq('student_id', userId)
                    .eq('status', 'active')
                    .single();
                if (!member) {
                    return res.status(403).json({ success: false, error: 'Không có quyền truy cập lớp học' });
                }
            }

            const { data: learners } = await supabase
                .from('classroom_students')
                .select('learner:users(id, full_name, email)')
                .eq('classroom_id', classroomId)
                .eq('status', 'active');

            const { data: assignments } = await supabase
                .from('assignments')
                .select('*')
                .eq('classroom_id', classroomId)
                .eq('is_active', true);

            res.json({ success: true, data: { classroom, learners, assignments } });
        } catch (error) {
            console.error('Get classroom details error:', error);
            res.status(500).json({ success: false, error: 'Không thể lấy thông tin lớp học' });
        }
    }

    // Get assignments of a classroom
    async getAssignments(req, res) {
        try {
            const userId = req.user.id;
            const { classroomId } = req.params;

            const { data: classroom } = await supabase
                .from('classrooms')
                .select('teacher_id')
                .eq('id', classroomId)
                .single();

            if (!classroom) {
                return res.status(404).json({ success: false, error: 'Lớp học không tồn tại' });
            }

            if (classroom.teacher_id !== userId) {
                const { data: member } = await supabase
                    .from('classroom_students')
                    .select('id')
                    .eq('classroom_id', classroomId)
                    .eq('student_id', userId)
                    .eq('status', 'active')
                    .single();
                if (!member) {
                    return res.status(403).json({ success: false, error: 'Không có quyền truy cập lớp học' });
                }
            }

            const { data: assignments, error } = await supabase
                .from('assignments')
                .select('*')
                .eq('classroom_id', classroomId)
                .eq('is_active', true)
                .order('created_at', { ascending: false });

            if (error) throw error;

            res.json({ success: true, data: assignments });
        } catch (error) {
            console.error('Get assignments error:', error);
            res.status(500).json({ success: false, error: 'Không thể lấy bài tập' });
        }
    }
    
    // Helper: Generate unique class code
    async generateUniqueClassCode() {
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code;
        let isUnique = false;
        
        while (!isUnique) {
            code = '';
            for (let i = 0; i < 6; i++) {
                code += characters.charAt(Math.floor(Math.random() * characters.length));
            }
            
            // Check if code exists
            const { data: existing } = await supabase
                .from('classrooms')
                .select('id')
                .eq('class_code', code)
                .single();
                
            if (!existing) {
                isUnique = true;
            }
        }
        
        return code;
    }
}

module.exports = new ClassroomController();