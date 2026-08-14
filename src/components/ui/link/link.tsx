import React from 'react'
import { Link as RouterLink, type LinkProps as RouterLinkProps } from 'react-router-dom'

export interface LinkProps extends RouterLinkProps {
  external?: boolean
}

export const Link: React.FC<LinkProps> = ({ external, ...props }) => {
  if (external) {
    return <a href={props.to as string} target="_blank" rel="noopener noreferrer" {...props} />
  }
  return <RouterLink {...props} />
}
