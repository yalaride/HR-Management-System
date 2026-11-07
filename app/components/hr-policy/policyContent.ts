export interface PolicySection {
  number: number;
  title: string;
  paragraphs: string[];
}

export const HR_POLICY_TITLE = "SYNC UP Human Resources Leave & Probation Policy";

export const HR_POLICY_SECTIONS: PolicySection[] = [
  {
    number: 1,
    title: "Purpose",
    paragraphs: [
      "This policy is designed to clearly explain the probation period, annual leave, emergency leave, attendance, and break-time requirements for all employees of SYNC UP.",
    ],
  },
  {
    number: 2,
    title: "Probation Period",
    paragraphs: [
      "All newly hired employees will have a probation period of three (3) months from their joining date.",
      "During the probation period, the annual leave policy will not apply.",
      "After completion of the three-month probation period, management will review the employee’s performance, attendance, punctuality, and overall conduct. Based on this review, management will decide whether to confirm the employee, extend the probation period, or discontinue the employment.",
    ],
  },
  {
    number: 3,
    title: "Annual Leave",
    paragraphs: [
      "An employee who successfully completes the three-month probation period will be entitled to thirty (30) leave days per calendar year.",
      "The annual leave entitlement will become applicable after successful completion of the probation period.",
      "Employees are expected to plan their leave responsibly and obtain approval before taking leave.",
    ],
  },
  {
    number: 4,
    title: "Carry Forward of Unused Leave",
    paragraphs: [
      "Any unused leave remaining at the end of the year will not automatically be carried forward.",
      "The decision to carry forward unused leave to the following year will be made subject to approval from the CEO.",
    ],
  },
  {
    number: 5,
    title: "Sick and Emergency Leave",
    paragraphs: [
      "In case of sickness or a genuine emergency, the employee must inform their reporting manager as soon as possible.",
      "The reporting manager will then inform the concerned person so that the leave can be properly recorded and maintained in the company’s attendance and leave records.",
      "Employees should provide reasonable information regarding the emergency or sickness when required by management.",
    ],
  },
  {
    number: 6,
    title: "Prior Notice for Leave",
    paragraphs: [
      "For planned leave, employees must inform their reporting manager at least two (2) days in advance.",
      "Leave taken without the required prior notice may not be considered approved and may result in salary deduction for the applicable day(s).",
      "Genuine emergencies will be considered separately by management.",
      "Employees should not assume that leave is approved until they receive confirmation from their reporting manager.",
    ],
  },
  {
    number: 7,
    title: "Break Time",
    paragraphs: [
      "The standard break time is from 2:00 PM to 3:00 PM.",
      "Employees may use this break for refreshments, prayer, and other personal needs.",
      "All employees are expected to return to their seats and resume their work on time after the break.",
      "Employees should ensure that the break does not extend beyond the approved break time unless specifically approved by management.",
    ],
  },
  {
    number: 8,
    title: "Attendance and Compliance",
    paragraphs: [
      "All employees are expected to maintain regular attendance, punctuality, and discipline during working hours.",
      "Employees must follow the leave approval process and inform their reporting manager whenever they are unable to attend work.",
      "Repeated unauthorized absences, late arrivals, extended breaks, or failure to follow this policy may result in appropriate disciplinary action and/or salary deduction as applicable.",
    ],
  },
  {
    number: 9,
    title: "Management Rights",
    paragraphs: [
      "SYNC UP reserves the right to review, amend, or update this policy based on business requirements and applicable laws.",
      "Management will have the final authority regarding probation confirmation, leave approval, carry-forward of unused leave, and exceptional circumstances.",
    ],
  },
];
