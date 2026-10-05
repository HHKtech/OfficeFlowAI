import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Employees
  const employeesData = [
    { name: 'Ali Khan', email: 'ali.khan@example.com', department: 'Engineering', role: 'Developer' },
    { name: 'Sara Ahmed', email: 'sara.ahmed@example.com', department: 'HR', role: 'HR Manager' },
    { name: 'Hamza Raza', email: 'hamza.raza@example.com', department: 'Sales', role: 'Sales Lead' },
    { name: 'Ayesha Noor', email: 'ayesha.noor@example.com', department: 'Marketing', role: 'Marketing Specialist' },
    { name: 'Omar Sheikh', email: 'omar.sheikh@example.com', department: 'IT', role: 'IT Admin' },
  ];

  for (const emp of employeesData) {
    await prisma.employee.upsert({
      where: { email: emp.email },
      update: {},
      create: emp,
    });
  }

  const adminEmployees = [
    {
      name: 'IT Admin',
      email: 'it.admin@gmail.com',
      previousEmail: 'it.admin@example.com',
      department: 'Administration',
      role: 'IT Operations Admin',
      appRole: 'ADMIN' as const,
    },
    {
      name: 'Facilities Admin',
      email: 'facilities.admin@gmail.com',
      previousEmail: 'facilities.admin@example.com',
      department: 'Administration',
      role: 'Facilities Operations Admin',
      appRole: 'ADMIN' as const,
    },
    {
      name: 'Security Admin',
      email: 'security.admin@gmail.com',
      previousEmail: 'security.admin@example.com',
      department: 'Administration',
      role: 'Security Operations Admin',
      appRole: 'ADMIN' as const,
    },
  ];

  for (const admin of adminEmployees) {
    const existingAdmin = await prisma.employee.findFirst({
      where: { email: { in: [admin.email, admin.previousEmail] } },
    });

    if (existingAdmin) {
      await prisma.employee.update({
        where: { id: existingAdmin.id },
        data: { email: admin.email },
      });
    } else {
      await prisma.employee.create({
        data: {
          name: admin.name,
          email: admin.email,
          department: admin.department,
          role: admin.role,
          appRole: admin.appRole,
        },
      });
    }
  }

  const ali = await prisma.employee.findUnique({ where: { email: 'ali.khan@example.com' } });
  const sara = await prisma.employee.findUnique({ where: { email: 'sara.ahmed@example.com' } });

  // Devices
  if (ali && sara) {
    await prisma.device.createMany({
      data: [
        { employeeId: ali.id, type: 'Laptop', model: 'MacBook Pro 16"', serialNumber: 'MBP-1001', status: 'ACTIVE' },
        { employeeId: sara.id, type: 'Laptop', model: 'Dell XPS 13', serialNumber: 'DXPS-2002', status: 'ACTIVE' },
      ],
      skipDuplicates: true,
    });
  }

  // Office Assets
  const assetsData = [
    { name: 'Conference Room A Projector', type: 'Projector', location: 'Conference Room A', status: 'ONLINE', assignedTeam: 'IT' },
    { name: 'Conference Room B Projector', type: 'Projector', location: 'Conference Room B', status: 'OFFLINE', assignedTeam: 'IT' },
    { name: 'Conference Room A AC', type: 'Air Conditioner', location: 'Conference Room A', status: 'ONLINE', assignedTeam: 'FACILITIES' },
    { name: 'Conference Room B AC', type: 'Air Conditioner', location: 'Conference Room B', status: 'OFFLINE', assignedTeam: 'FACILITIES' },
    { name: 'Office Printer', type: 'Printer', location: 'Main Office', status: 'ONLINE', assignedTeam: 'IT' },
    { name: 'Meeting Room Display', type: 'Display', location: 'Meeting Room 1', status: 'ONLINE', assignedTeam: 'IT' },
    { name: 'WiFi Access Point', type: 'Networking', location: 'Ceiling - Floor 2', status: 'ONLINE', assignedTeam: 'IT' },
    { name: 'Office Lights', type: 'Lighting', location: 'Entire Floor', status: 'ONLINE', assignedTeam: 'FACILITIES' },
  ];

  await prisma.officeAsset.createMany({
    data: assetsData,
    skipDuplicates: true,
  });

  // Policies
  const policiesData = [
    { category: 'hardware incidents', title: 'Hardware Repair Policy', content: 'For all hardware incidents, contact IT. Laptops are replaced if beyond repair.' },
    { category: 'meeting room equipment', title: 'Meeting Room Equipment Rules', content: 'Equipment in meeting rooms must not be moved. Report any issues to IT.' },
    { category: 'facilities issues', title: 'Facilities Maintenance', content: 'AC or plumbing issues should be reported to Facilities immediately.' },
    { category: 'lost devices', title: 'Lost Device Policy', content: 'Lost devices must be reported to Security immediately to revoke access.' },
    { category: 'security incidents', title: 'Security Incident Protocol', content: 'All security breaches must be escalated to the Security team immediately.' },
    { category: 'access requests', title: 'Building Access', content: 'Requests for building access require manager approval.' },
    { category: 'priority rules', title: 'Ticket Priority Guidelines', content: 'Critical tickets must be resolved in 1 hour. High priority in 4 hours.' },
    { category: 'approval rules', title: 'Approval Requirements', content: 'Any request involving a cost over $500 requires approval.' },
  ];

  await prisma.policy.createMany({
    data: policiesData,
    skipDuplicates: true,
  });

  // Historical Tickets
  if (ali) {
    await prisma.ticket.create({
      data: {
        employeeId: ali.id,
        category: 'IT',
        title: 'Mouse not working',
        description: 'My wireless mouse ran out of battery or broke.',
        priority: 'LOW',
        status: 'RESOLVED',
        assignedTeam: 'IT',
      }
    });
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
