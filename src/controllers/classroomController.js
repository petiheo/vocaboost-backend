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
                    max_learners: maxLearners,
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
                    learner_count:classroom_learners(count)
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
                learner_count: classroom.learner_count[0]?.count || 0,
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
    
    // USC15: Add/Remove learners
    async inviteLearners(req, res) {
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
                .from('classroom_learners')
                .select('*', { count: 'exact', head: true })
                .eq('classroom_id', classroomId)
                .eq('status', 'active');
                
            if (currentLearners + emails.length > classroom.max_learners) {
                return res.status(400).json({
                    success: false,
                    error: `Lớp học chỉ còn ${classroom.max_learners - currentLearners} chỗ trống`
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
            console.error('Invite learners error:', error);
            res.status(500).json({
                success: false,
                error: 'Không thể gửi lời mời'
            });
        }
    }
    
    // Remove learners from classroom
    async removeLearners(req, res) {
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
            
            // Update learner status
            const { error } = await supabase
                .from('classroom_learners')
                .update({ 
                    status: 'removed',
                    left_at: new Date()
                })
                .eq('classroom_id', classroomId)
                .in('learner_id', learnerIds);
                
            if (error) throw error;
            
            res.json({
                success: true,
                message: `Đã xóa ${learnerIds.length} học sinh khỏi lớp`
            });
            
        } catch (error) {
            console.error('Remove learners error:', error);
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
                .from('classroom_learners')
                .select('learner_id')
                .eq('classroom_id', classroomId)
                .eq('status', 'active');

            if (learners && learners.length > 0) {
                const learnerAssignments = learners.map(s => ({
                    assignment_id: assignment.id,
                    learner_id: s.learner_id,
                    status: 'assigned'
                }));

                await supabase
                    .from('learner_assignments')
                    .insert(learnerAssignments);

                // Send notifications to learners
                const notifications = learners.map(s => ({
                    user_id: s.learner_id,
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
                .from('classroom_learners')
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
                    submissions:learner_assignments(
                        learner_id,
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
    
    // Learner join classroom
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
                .from('classroom_learners')
                .select('id')
                .eq('classroom_id', classroom.id)
                .eq('learner_id', learnerId)
                .single();
                
            if (existing) {
                return res.status(400).json({
                    success: false,
                    error: 'Bạn đã tham gia lớp học này rồi'
                });
            }
            
            // Check capacity
            const { count: currentLearners } = await supabase
                .from('classroom_learners')
                .select('*', { count: 'exact', head: true })
                .eq('classroom_id', classroom.id)
                .eq('status', 'active');
                
            if (currentLearners >= classroom.max_learners) {
                return res.status(400).json({
                    success: false,
                    error: 'Lớp học đã đầy'
                });
            }
            
            // Join classroom
            const { error: joinError } = await supabase
                .from('classroom_learners')
                .insert({
                    classroom_id: classroom.id,
                    learner_id: learnerId,
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

    // Get classes of current user (learner)
    async getMyClasses(req, res) {
        try {
            const learnerId = req.user.id;

            const { data: classes, error } = await supabase
                .from('classroom_learners')
                .select('classroom:classrooms(*)')
                .eq('learner_id', learnerId)
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
                    .from('classroom_learners')
                    .select('id')
                    .eq('classroom_id', classroomId)
                    .eq('learner_id', userId)
                    .eq('status', 'active')
                    .single();
                if (!member) {
                    return res.status(403).json({ success: false, error: 'Không có quyền truy cập lớp học' });
                }
            }

            const { data: learners } = await supabase
                .from('classroom_learners')
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
                    .from('classroom_learners')
                    .select('id')
                    .eq('classroom_id', classroomId)
                    .eq('learner_id', userId)
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

    // USC15: Invite students via email  
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
            const { count: currentStudents } = await supabase
                .from('classroom_learners')
                .select('*', { count: 'exact', head: true })
                .eq('classroom_id', classroomId)
                .eq('status', 'active');
                
            if (currentStudents + emails.length > classroom.max_learners) {
                return res.status(400).json({
                    success: false,
                    error: `Lớp học chỉ còn ${classroom.max_learners - currentStudents} chỗ trống`
                });
            }
            
            // Check for existing users and invitations
            const { data: existingUsers } = await supabase
                .from('users')
                .select('email')
                .in('email', emails);
                
            const { data: existingInvites } = await supabase
                .from('classroom_invitations')
                .select('email')
                .eq('classroom_id', classroomId)
                .in('email', emails)
                .eq('status', 'pending');
                
            const existingUserEmails = existingUsers?.map(u => u.email) || [];
            const existingInviteEmails = existingInvites?.map(i => i.email) || [];
            
            // Filter out emails that already have pending invitations
            const newEmails = emails.filter(email => 
                !existingInviteEmails.includes(email)
            );
            
            if (newEmails.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Tất cả email đã được mời hoặc đã tham gia lớp học'
                });
            }
            
            // Create invitations
            const invitations = [];
            const emailPromises = [];
            
            for (const email of newEmails) {
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
                        teacherName: req.user.full_name || req.user.name,
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
            
            // Send emails (don't wait for completion)
            Promise.all(emailPromises).catch(err => 
                console.error('Email sending error:', err)
            );
            
            // Handle existing users - auto-add them to classroom
            const existingUsersToAdd = [];
            if (existingUserEmails.length > 0) {
                const { data: usersToAdd } = await supabase
                    .from('users')
                    .select('id, email')
                    .in('email', existingUserEmails);
                    
                for (const user of usersToAdd) {
                    // Check if user is already in classroom
                    const { data: existing } = await supabase
                        .from('classroom_learners')
                        .select('id')
                        .eq('classroom_id', classroomId)
                        .eq('learner_id', user.id)
                        .single();
                        
                    if (!existing) {
                        existingUsersToAdd.push({
                            classroom_id: classroomId,
                            learner_id: user.id,
                            status: 'active',
                            joined_at: new Date()
                        });
                    }
                }
                
                if (existingUsersToAdd.length > 0) {
                    await supabase
                        .from('classroom_learners')
                        .insert(existingUsersToAdd);
                }
            }
            
            res.json({
                success: true,
                data: {
                    invitesSent: newEmails.length,
                    usersAdded: existingUsersToAdd.length,
                    totalProcessed: emails.length
                },
                message: `Đã xử lý ${emails.length} email: ${newEmails.length} lời mời được gửi, ${existingUsersToAdd.length} người dùng được thêm trực tiếp`
            });
            
        } catch (error) {
            console.error('Invite students error:', error);
            res.status(500).json({
                success: false,
                error: 'Không thể gửi lời mời tham gia lớp học'
            });
        }
    }

    // Remove students from classroom
    async removeStudents(req, res) {
        try {
            const teacherId = req.user.id;
            const { classroomId } = req.params;
            const { studentIds } = req.body;
            
            // Validate input
            if (!Array.isArray(studentIds) || studentIds.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Danh sách học sinh không hợp lệ'
                });
            }
            
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
            
            // Check which students are actually in the classroom
            const { data: existingStudents, error: checkError } = await supabase
                .from('classroom_learners')
                .select('learner_id, users(full_name, email)')
                .eq('classroom_id', classroomId)
                .in('learner_id', studentIds)
                .eq('status', 'active');
                
            if (checkError) throw checkError;
            
            if (existingStudents.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Không tìm thấy học sinh nào trong lớp học'
                });
            }
            
            const validStudentIds = existingStudents.map(s => s.learner_id);
            
            // Remove students from classroom (soft delete)
            const { error: removeError } = await supabase
                .from('classroom_learners')
                .update({ 
                    status: 'removed',
                    left_at: new Date()
                })
                .eq('classroom_id', classroomId)
                .in('learner_id', validStudentIds);
                
            if (removeError) throw removeError;
            
            // Also remove/cancel any pending assignments for these students
            await supabase
                .from('assignment_submissions')
                .update({ status: 'cancelled' })
                .eq('classroom_id', classroomId)
                .in('learner_id', validStudentIds)
                .eq('status', 'pending');
            
            // Log activity
            const activityLogs = validStudentIds.map(studentId => ({
                classroom_id: classroomId,
                user_id: teacherId,
                action: 'remove_student',
                details: {
                    removed_student_id: studentId,
                    removed_student_name: existingStudents.find(s => s.learner_id === studentId)?.users?.full_name
                }
            }));
            
            await supabase
                .from('classroom_activity_logs')
                .insert(activityLogs)
                .select();
            
            res.json({
                success: true,
                data: {
                    removedCount: validStudentIds.length,
                    removedStudents: existingStudents.map(s => ({
                        id: s.learner_id,
                        name: s.users?.full_name,
                        email: s.users?.email
                    }))
                },
                message: `Đã xóa ${validStudentIds.length} học sinh khỏi lớp học`
            });
            
        } catch (error) {
            console.error('Remove students error:', error);
            res.status(500).json({
                success: false,
                error: 'Không thể xóa học sinh khỏi lớp học'
            });
        }
    }
}

module.exports = new ClassroomController();