const demoTokenKey = 'company-demo-token';

export function getDemoToken(): string | null {
  return sessionStorage.getItem(demoTokenKey);
}

export function setDemoToken(token: string): void {
  sessionStorage.setItem(demoTokenKey, token);
}

export function clearDemoToken(): void {
  sessionStorage.removeItem(demoTokenKey);
}
