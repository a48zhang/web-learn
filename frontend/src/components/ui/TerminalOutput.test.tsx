import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TerminalOutput } from './TerminalOutput';

describe('TerminalOutput', () => {
  it('renders cleaned text without visible ESC controls', () => {
    render(<TerminalOutput value={'␛[1G␛[0K␛[1mnpm␛[22m ␛[31merror␛[39m'} />);

    expect(screen.getByText('npm')).toBeInTheDocument();
    expect(screen.getByText('error')).toBeInTheDocument();
    expect(screen.queryByText(/␛\[1G/)).not.toBeInTheDocument();
  });

  it('applies error border styling when state is error', () => {
    const { container } = render(<TerminalOutput value={'failed'} state="error" />);

    expect(container.firstChild).toHaveClass('border-red-900/50');
  });
});
