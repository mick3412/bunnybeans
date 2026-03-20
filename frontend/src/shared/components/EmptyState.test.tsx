import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('renders message', () => {
    render(<EmptyState message="尚無資料" />);
    expect(screen.getByText('尚無資料')).toBeInTheDocument();
  });

  it('renders description when provided', () => {
    render(<EmptyState message="空" description="請新增一筆" />);
    expect(screen.getByText('空')).toBeInTheDocument();
    expect(screen.getByText('請新增一筆')).toBeInTheDocument();
  });

  it('does not render description when not provided', () => {
    render(<EmptyState message="空" />);
    expect(screen.queryByText('請新增一筆')).not.toBeInTheDocument();
  });
});
