import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '../../../tests/helpers/render';
import ActivityCreateModal from './ActivityCreateModal';

vi.mock('../../../src/store/tripStore', () => ({
  useTripStore: (selector: (s: unknown) => unknown) => selector({ createActivity: vi.fn() }),
}));

describe('ActivityCreateModal', () => {
  it('stays hidden when closed', () => {
    render(<ActivityCreateModal isOpen={false} onClose={vi.fn()} tripId={1} dayId={2} places={[]} reservations={[]} />);
    expect(screen.queryByText('添加活动')).not.toBeInTheDocument();
  });
  it('shows the selected day activity form', () => {
    render(
      <ActivityCreateModal
        isOpen
        onClose={vi.fn()}
        tripId={1}
        dayId={2}
        places={[{ id: 3, name: 'Museum' } as never]}
        reservations={[]}
      />
    );
    expect(screen.getByRole('heading', { name: '添加活动' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Museum' })).toBeInTheDocument();
  });
});
