// ============================================================
//  DATABASE SEED — Data ya majaribio (demo users, posts, poll)
//  Run: npm run seed
//  KUMBUKA: Hii ni kwa mazingira ya development/testing TU.
// ============================================================
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { sequelize, User, Post, Poll, PollOption, Group, GroupMember } = require('../models');

async function seed() {
  try {
    await sequelize.authenticate();
    console.log('✅ Imeunganika na database');

    const password = await bcrypt.hash('Password123!', 12);

    const [teacher] = await User.findOrCreate({
      where: { email: 'mwalimu@udsm.ac.tz' },
      defaults: {
        name: 'Dkt. Amina Hassan', password, role: 'teacher',
        department: 'Computer Science', isActive: true, isVerified: true,
      },
    });

    const students = [];
    const sampleStudents = [
      { name: 'Juma Mwakalinga', email: 'juma@udsm.ac.tz', studentId: 'UDSM/CS/001', department: 'Computer Science', yearOfStudy: 2 },
      { name: 'Fatuma Ally', email: 'fatuma@udsm.ac.tz', studentId: 'UDSM/CS/002', department: 'Computer Science', yearOfStudy: 3 },
      { name: 'Zainabu Said', email: 'zainabu@udsm.ac.tz', studentId: 'UDSM/BUS/001', department: 'Business Administration', yearOfStudy: 1 },
    ];

    for (const s of sampleStudents) {
      const [student] = await User.findOrCreate({
        where: { email: s.email },
        defaults: { ...s, password, role: 'student', isActive: true, isVerified: true },
      });
      students.push(student);
    }

    console.log(`✅ Watumiaji ${students.length + 1} wameundwa (1 mwalimu, ${students.length} wanafunzi)`);

    // Sample post
    const [post] = await Post.findOrCreate({
      where: { userId: teacher.id, content: 'Karibuni kwenye UDSM Social Hub! 🎓 Sehemu ya kuunganika, kujadili, na kushirikiana kimasomo.' },
      defaults: { userId: teacher.id, content: 'Karibuni kwenye UDSM Social Hub! 🎓 Sehemu ya kuunganika, kujadili, na kushirikiana kimasomo.', visibility: 'public' },
    });
    console.log('✅ Sample post imeundwa');

    // Sample poll
    const [poll, pollCreated] = await Poll.findOrCreate({
      where: { userId: teacher.id, question: 'Unapendelea njia gani ya kujifunza zaidi?' },
      defaults: { userId: teacher.id, question: 'Unapendelea njia gani ya kujifunza zaidi?', isActive: true },
    });
    if (pollCreated) {
      await PollOption.bulkCreate([
        { pollId: poll.id, label: 'Mihadhara ya darasani', order: 1 },
        { pollId: poll.id, label: 'Video za mtandaoni', order: 2 },
        { pollId: poll.id, label: 'Majadiliano ya vikundi', order: 3 },
      ]);
      console.log('✅ Sample poll imeundwa');
    }

    // Sample group
    const [group, groupCreated] = await Group.findOrCreate({
      where: { name: 'Computer Science Class of 2026' },
      defaults: {
        name: 'Computer Science Class of 2026', description: 'Kikundi rasmi cha wanafunzi wa CS',
        creatorId: teacher.id, department: 'Computer Science', category: 'academic',
      },
    });
    if (groupCreated) {
      await GroupMember.create({ groupId: group.id, userId: teacher.id, role: 'admin' });
      console.log('✅ Sample group imeundwa');
    }

    console.log('\n🎉 Seeding imekamilika! Unaweza kuingia (login) na:');
    console.log('   Email: mwalimu@udsm.ac.tz | Password: Password123!');
    console.log('   Email: juma@udsm.ac.tz    | Password: Password123!');
    console.log('   (Admin tayari yupo kutoka migration.sql: admin@udsm.ac.tz / Admin@UDSM2024!)');

  } catch (err) {
    console.error('❌ Seeding imeshindwa:', err.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

seed();
