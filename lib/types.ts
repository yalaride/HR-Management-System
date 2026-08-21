// types.ts
export interface LeaveRequest {
  id: string; 
  userId?: string;
  employeeName: string;
  designation: string;
  department: string;

  type: "Annual Leave" | "Sick Leave" | "Casual Leave" | "Unpaid Leave" | "Other Leave";
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: "Pending" | "Approved" | "Rejected";
  totalLeaves?: number;
  usedLeaves?: number;
  remainingLeaves?: number;
}

export interface LeaveBalance {
  allocated: number;
  used: number;
  remaining: number;
}

export interface LeaveBalances {
  ANNUAL: LeaveBalance;
  SICK: LeaveBalance;
  CASUAL: LeaveBalance;
}
export interface EmployeeBirthday {
  id: string;
  name: string;
  email: string;
  department: string;
  designation: string;
  profilePhotoUrl?: string;
  birthDate: string;
  birthDay: number;
  birthMonth: number;
  birthdayEmailStatus?: "Sent" | "Scheduled" | "Pending" | "Failed";
}