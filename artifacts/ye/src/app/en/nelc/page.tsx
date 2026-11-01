import { permanentRedirect } from 'next/navigation';

// Public NELC readiness marketing page retired — FunAdemy programs are in person.
export default function NelcRedirect() {
  return permanentRedirect('/en/contact');
}
