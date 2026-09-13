import { render, screen } from '../../../tests/helpers/render';
import Button from './Button';

describe('Button', () => {
  it('renders the primary button with the requested size and theme styles', () => {
    render(<Button size="lg">Add Activity</Button>);

    const button = screen.getByRole('button', { name: 'Add Activity' });
    expect(button).toHaveClass('inline-flex', 'text-base', 'hover:-translate-y-0.5');
    expect(button).toHaveStyle({
      background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-hover) 100%)',
      borderRadius: 'var(--radius-md)',
    });
    // The primary shadow rides on a Tailwind class now, not an inline style.
    expect(button).toHaveClass('shadow-[var(--shadow-primary)]');
  });

  it('preserves native button props and supports secondary styling', () => {
    render(
      <Button variant="secondary" size="sm" type="submit" disabled>
        Cancel
      </Button>
    );

    const button = screen.getByRole('button', { name: 'Cancel' });
    expect(button).toHaveAttribute('type', 'submit');
    expect(button).toBeDisabled();
    expect(button).toHaveClass('border-gray-200', 'text-xs');
  });
});
