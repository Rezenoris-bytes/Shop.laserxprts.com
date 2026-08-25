import { forwardRef } from 'react';
import PhoneInputNative from 'react-phone-number-input';
import 'react-phone-number-input/style.css';

interface PhoneInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  autoComplete?: string;
}

export const PhoneInput = forwardRef<any, PhoneInputProps>(
  ({ id, value, onChange, className, placeholder, autoComplete }, ref) => {
    return (
      <PhoneInputNative
        id={id}
        ref={ref}
        value={value}
        onChange={(val) => onChange(val || '')}
        className={['field flex items-center focus-within:border-amber', className].filter(Boolean).join(' ')}
        numberInputProps={{
          className: 'w-full border-0 bg-transparent p-0 text-sm focus:outline-none focus:ring-0 placeholder:text-ink-muted',
          autoComplete,
        }}
        placeholder={placeholder}
        defaultCountry="IN"
        international
      />
    );
  }
);
PhoneInput.displayName = 'PhoneInput';
