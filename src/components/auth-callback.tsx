import { useEffect, useState } from 'react';
import { Redirect, router } from 'expo-router';
import * as Linking from 'expo-linking';
import { Text } from 'react-native';
import { useAuth } from '@/data/auth';
import { completeAuthLink } from '@/services/auth';
import { Screen } from './screen';
import { Button } from './ui';

export function AuthCallbackScreen() {
  const url = Linking.useLinkingURL();
  const auth = useAuth();
  const [finished, setFinished] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!auth.ready || !url) return;
    let active = true;
    void completeAuthLink(url).then(() => { if (active) setFinished(true); }).catch(e => { if (active) setError(e instanceof Error ? e.message : 'Unable to confirm this link.'); });
    return () => { active = false; };
  }, [auth.ready, url]);
  if (finished && auth.session) return <Redirect href={auth.recovering ? '/reset-password' : '/explore'} />;
  return <Screen><Text>{error || (finished ? 'This link has no active session. Please log in or request a new link.' : 'Confirming your email...')}</Text>{error || finished ? <Button label="Back to login" onPress={() => router.replace('/login')} /> : null}</Screen>;
}
