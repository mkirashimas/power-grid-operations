import {
  IconButton as MuiIconButton,
  Tooltip,
  type IconButtonProps as MuiIconButtonProps,
  type TooltipProps,
} from '@mui/material';

export interface IconButtonProps extends Omit<MuiIconButtonProps, 'aria-label' | 'title'> {
  /** Accessible name and tooltip text. Required: an icon alone has no name. */
  label: string;
  tooltipPlacement?: TooltipProps['placement'];
}

/** An icon-only button whose label is both its accessible name and its tooltip. */
export const IconButton = ({ label, tooltipPlacement, children, ...props }: IconButtonProps) => {
  const button = (
    <MuiIconButton aria-label={label} {...props}>
      {children}
    </MuiIconButton>
  );
  return (
    <Tooltip title={label} placement={tooltipPlacement}>
      {/* A disabled button fires no events, so the tooltip needs a wrapper to listen on. */}
      {props.disabled ? <span>{button}</span> : button}
    </Tooltip>
  );
};
