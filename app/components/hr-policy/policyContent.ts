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
      "This policy is designed to clearly explain the probation period, monthly leave, and attendance requirements for all employees of SYNC UP.",
    ],
  },
  {
    number: 2,
    title: "Probation Period",
    paragraphs: [
      "All newly hired employees will have a probation period of three (3) months from their joining date.",
      "During the probation period, the monthly leave allowance does not apply.",
      "After completion of the three-month probation period, management will review the employee’s performance, attendance, punctuality, and overall conduct. Based on this review, management will decide whether to confirm the employee, extend the probation period, or discontinue the employment.",
    ],
  },
  {
    number: 3,
    title: "Monthly Leave",
    paragraphs: [
      "A Permanent or Contract employee receives 2 full days and 1 half day in each calendar month. That is 20 hours.",
      "Unused leave stays in that month. It is not added to the next month.",
      "An employee applies at least 2 days before the leave starts. Sunday is not a leave day.",
      "Urgent leave and extra paid leave are set by Admin.",
    ],
  },
  {
    number: 4,
    title: "No Carry Forward",
    paragraphs: [
      "Leave that is not used by the end of the month is not carried into the next month.",
    ],
  },
  {
    number: 5,
    title: "Sickness and Emergency",
    paragraphs: [
      "Sickness and emergencies use the same monthly leave. There is no separate sick or casual balance.",
      "The employee must inform their reporting manager as soon as possible.",
      "A date inside the 2-day notice window can be set by Admin as urgent leave.",
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
    title: "Attendance and Compliance",
    paragraphs: [
      "All employees are expected to maintain regular attendance, punctuality, and discipline during working hours.",
      "Employees must follow the leave approval process and inform their reporting manager whenever they are unable to attend work.",
      "Repeated unauthorized absences, late arrivals, or failure to follow this policy may result in appropriate disciplinary action and/or salary deduction as applicable.",
    ],
  },
  {
    number: 8,
    title: "Management Rights",
    paragraphs: [
      "SYNC UP reserves the right to review, amend, or update this policy based on business requirements and applicable laws.",
      "Management will have the final authority regarding probation confirmation, leave approval, and exceptional circumstances.",
    ],
  },
];
