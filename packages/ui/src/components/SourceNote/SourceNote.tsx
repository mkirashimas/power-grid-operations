import { Link, Typography } from '@mui/material';

export interface SourceNoteProps {
  /** Translated prefix, e.g. "Source:". */
  prefix: string;
  /** Source name, kept as published, e.g. "U.S. Energy Information Administration". */
  name: string;
  href: string;
  /** Optional freshness, e.g. "live, refreshed hourly". */
  status?: string;
}

/** Credits a data source with a link, e.g. "Source: U.S. Energy Information Administration · live". */
export const SourceNote = ({ prefix, name, href, status }: SourceNoteProps) => (
  <Typography variant="body2" color="text.secondary">
    {prefix}{' '}
    <Link href={href} color="inherit" rel="noopener noreferrer">
      {name}
    </Link>
    {status && ` · ${status}`}
  </Typography>
);
