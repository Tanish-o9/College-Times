import React from 'react';
import { Feed } from './Feed';
import { ErrorBoundary } from '../../components/ErrorBoundary';

export const FeedPage: React.FC = () => {
  return (
    <ErrorBoundary fallbackMessage="Something went wrong loading the feed">
      <Feed />
    </ErrorBoundary>
  );
};

export { Feed };


