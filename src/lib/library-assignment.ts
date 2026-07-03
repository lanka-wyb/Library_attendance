export function getAssignedLibrary(regNum: string): "MAIN" | "MKDL" | "MEDL" | null {
  const cleanReg = regNum.trim().toLowerCase();
  if (cleanReg.startsWith('x') || cleanReg.startsWith('v')) {
    return null; // Unrestricted access
  }
  const digits = cleanReg.replace(/\D/g, '');
  if (digits.length < 3) {
    return "MAIN"; // Default fallback
  }
  const thirdDigit = digits[2];
  if (thirdDigit === '1') {
    return "MEDL";
  }
  if (thirdDigit === '6' || thirdDigit === '8') {
    return "MKDL";
  }
  // For '2', '4', '9' and any fallback
  return "MAIN";
}

export function getFacultyName(regNum: string): string {
  const cleanReg = regNum.trim().toLowerCase();
  if (cleanReg.startsWith('x') || cleanReg.startsWith('v')) {
    return "Exempt / Guest";
  }
  const digits = cleanReg.replace(/\D/g, '');
  if (digits.length < 3) {
    return "Unknown";
  }
  const thirdDigit = digits[2];
  switch (thirdDigit) {
    case '1':
      return "Medicine";
    case '2':
      return "Applied Sciences";
    case '4':
      return "Management";
    case '6':
      return "APM (Advanced Project Management)";
    case '8':
      return "Technology / LFN";
    default:
      return "Other";
  }
}
