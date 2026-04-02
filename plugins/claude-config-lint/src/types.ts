export interface ValidationError {
  file: string;
  field?: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  filesChecked: string[];
}
