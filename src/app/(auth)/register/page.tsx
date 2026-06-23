import { getOAuthProviderStatus } from '../components/oauth-provider-checker'
import RegisterForm from '../register/register-form'
import { generateMetadata } from '@/lib/seo'
import { isEmailVerificationEnabled } from '@/config/feature-flags'

export const dynamic = 'force-dynamic'

export const metadata = generateMetadata({
  title: 'Inscription | Alstock',
})

export default async function RegisterPage() {
  const { githubAvailable, googleAvailable, facebookAvailable, microsoftAvailable, isProduction } =
    await getOAuthProviderStatus()

  return (
    <RegisterForm
      githubAvailable={githubAvailable}
      googleAvailable={googleAvailable}
      facebookAvailable={facebookAvailable}
      microsoftAvailable={microsoftAvailable}
      isProduction={isProduction}
      emailVerificationEnabled={isEmailVerificationEnabled}
    />
  )
}
