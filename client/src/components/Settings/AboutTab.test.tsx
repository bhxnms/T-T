import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '../../../tests/helpers/render';
import { resetAllStores } from '../../../tests/helpers/store';
import { useAuthStore } from '../../store/authStore';
import AboutTab from './AboutTab';

beforeEach(() => {
  resetAllStores();
  vi.clearAllMocks();
});

describe('AboutTab', () => {
  it('FE-COMP-ABOUT-001: renders without crashing', () => {
    render(<AboutTab appVersion="2.9.10" />);
    expect(document.body).toBeInTheDocument();
  });

  it('FE-COMP-ABOUT-002: displays the version badge', () => {
    render(<AboutTab appVersion="2.9.10" />);
    expect(screen.getByText('v2.9.10')).toBeInTheDocument();
  });

  it('FE-COMP-ABOUT-003: displays the bug-report card with the TT mail link', () => {
    render(<AboutTab appVersion="2.9.10" />);
    const link = screen.getByText('Report a Bug').closest('a');
    expect(link).toHaveAttribute('href', 'mailto:bhxnms@gmail.com?subject=TT%20Bug%20Report');
  });

  it('FE-COMP-ABOUT-004: displays the feature-request card with the TT mail link', () => {
    render(<AboutTab appVersion="2.9.10" />);
    const link = screen.getByText('Feature Request').closest('a');
    expect(link).toHaveAttribute('href', 'mailto:bhxnms@gmail.com?subject=TT%20Feature%20Request');
  });

  it('FE-COMP-ABOUT-005: no third-party support/funding links remain', () => {
    render(<AboutTab appVersion="2.9.10" />);
    // The TREK funding/community cards were dropped with the de-branding.
    expect(screen.queryByText('Ko-fi')).toBeNull();
    expect(screen.queryByText('Buy Me a Coffee')).toBeNull();
    expect(screen.queryByText('Discord')).toBeNull();
    expect(document.querySelector('a[href*="ko-fi.com"]')).toBeNull();
    expect(document.querySelector('a[href*="buymeacoffee.com"]')).toBeNull();
    expect(document.querySelector('a[href*="discord.gg"]')).toBeNull();
  });

  it('FE-COMP-ABOUT-006: bug-report link carries the TT subject line', () => {
    render(<AboutTab appVersion="2.9.10" />);
    const link = document.querySelector('a[href*="subject=TT%20Bug%20Report"]');
    expect(link).toBeInTheDocument();
  });

  it('FE-COMP-ABOUT-007: feature-request link carries the TT subject line', () => {
    render(<AboutTab appVersion="2.9.10" />);
    const link = document.querySelector('a[href*="subject=TT%20Feature%20Request"]');
    expect(link).toBeInTheDocument();
  });

  it('FE-COMP-ABOUT-008: managed mode swaps the support cards for the source link', () => {
    useAuthStore.setState({ managed: true });
    render(<AboutTab appVersion="2.9.10" />);
    // AGPL §13: the source stays offered, the support cards go.
    expect(screen.queryByText('Report a Bug')).toBeNull();
    expect(screen.queryByText('Feature Request')).toBeNull();
    const source = screen.getByText('Source code').closest('a');
    expect(source).toHaveAttribute('href', 'https://github.com/bhxnms/T-T');
    expect(source).toHaveAttribute('target', '_blank');
    expect(source).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('FE-COMP-ABOUT-009: external (https) links have rel="noopener noreferrer"', () => {
    useAuthStore.setState({ managed: true });
    render(<AboutTab appVersion="2.9.10" />);
    const links = Array.from(document.querySelectorAll('a[href^="https://"]'));
    expect(links.length).toBeGreaterThan(0);
    links.forEach((link) => {
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });

  it('FE-COMP-ABOUT-010: external (https) links open in a new tab', () => {
    useAuthStore.setState({ managed: true });
    render(<AboutTab appVersion="2.9.10" />);
    const links = Array.from(document.querySelectorAll('a[href^="https://"]'));
    links.forEach((link) => {
      expect(link).toHaveAttribute('target', '_blank');
    });
  });

  it('FE-COMP-ABOUT-011: version prop change is reflected', () => {
    render(<AboutTab appVersion="1.0.0" />);
    expect(screen.getByText('v1.0.0')).toBeInTheDocument();
    expect(screen.queryByText('v2.9.10')).toBeNull();
  });

  it('FE-COMP-ABOUT-012: bug-report card hover changes border and box-shadow styles', () => {
    render(<AboutTab appVersion="1.0.0" />);
    const link = screen.getByText('Report a Bug').closest('a') as HTMLAnchorElement;
    fireEvent.mouseEnter(link);
    expect(link.style.borderColor).toBe('rgb(239, 68, 68)');
    expect(link.style.boxShadow).not.toBe('');
    fireEvent.mouseLeave(link);
    expect(link.style.borderColor).toBe('var(--border-primary)');
    expect(link.style.boxShadow).toBe('none');
  });

  it('FE-COMP-ABOUT-013: feature-request card hover changes border and box-shadow styles', () => {
    render(<AboutTab appVersion="1.0.0" />);
    const link = screen.getByText('Feature Request').closest('a') as HTMLAnchorElement;
    fireEvent.mouseEnter(link);
    expect(link.style.borderColor).toBe('rgb(245, 158, 11)');
    expect(link.style.boxShadow).not.toBe('');
    fireEvent.mouseLeave(link);
    expect(link.style.borderColor).toBe('var(--border-primary)');
    expect(link.style.boxShadow).toBe('none');
  });

  it('FE-COMP-ABOUT-014: the derivation note names the product as a TREK fork', () => {
    render(<AboutTab appVersion="1.0.0" />);
    expect(screen.getByText('Tourism-Team is a personal fork based on TREK.')).toBeInTheDocument();
  });
});
