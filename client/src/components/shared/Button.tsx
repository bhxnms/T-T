import React from 'react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
}

export default function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  style,
  ...props
}: ButtonProps) {
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-lg transition-all'

  const variantStyles = {
    primary: 'text-white shadow-[var(--shadow-primary)] hover:shadow-[var(--shadow-primary-hover)] hover:-translate-y-0.5',
    secondary: 'bg-white border-[1.5px] border-gray-200 text-gray-700 hover:border-purple-500 hover:bg-gray-50',
    ghost: 'bg-gray-100 text-gray-700 hover:bg-purple-500 hover:text-white'
  }

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-4 py-2.5 text-sm gap-2',
    lg: 'px-6 py-3 text-base gap-2.5'
  }

  const primaryStyle = variant === 'primary' ? {
    background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-hover) 100%)',
    borderRadius: 'var(--radius-md)',
    ...style
  } : style

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      style={primaryStyle}
      {...props}
    >
      {children}
    </button>
  )
}
