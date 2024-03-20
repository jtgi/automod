// app/routes/privacy-policy.tsx
import { MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = () => [{ title: "Privacy Policy" }];

const PrivacyPolicy = () => {
  return (
    <div className="max-w-4xl mx-auto p-6 bg-white shadow rounded-lg">
      <h1 className="text-3xl font-bold text-center mb-6">Privacy Policy</h1>

      <section className="mb-6">
        <h2 className="text-2xl font-semibold mb-3">Introduction</h2>
        <p className="mb-3">
          We respect the privacy of our users and are committed to protecting your personal information. This
          policy outlines our practices regarding data collection, use, and sharing.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-2xl font-semibold mb-3">Data Collection</h2>
        <p className="mb-3">We collect information necessary to provide our services, including:</p>
        <ul className="list-disc pl-6">
          <li>Personal details (e.g., name, email address) when you sign up.</li>
          <li>Payment information for processing transactions securely.</li>
          <li>Technical data (e.g., IP address, browser type) for service improvement.</li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="text-2xl font-semibold mb-3">Data Use</h2>
        <p className="mb-3">We use your information to:</p>
        <ul className="list-disc pl-6">
          <li>Provide and improve our services.</li>
          <li>Process payments securely.</li>
          <li>Communicate important service updates.</li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="text-2xl font-semibold mb-3">Data Sharing</h2>
        <p className="mb-3">
          We only share your information with third parties when necessary for service provision or legal
          requirements, including:
        </p>
        <ul className="list-disc pl-6">
          <li>Payment processors, like Stripe, for transaction purposes.</li>
          <li>Law enforcement, if required by law or to protect our rights.</li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="text-2xl font-semibold mb-3">Your Rights</h2>
        <p className="mb-3">You have rights regarding your data, including:</p>
        <ul className="list-disc pl-6">
          <li>Accessing and updating your information.</li>
          <li>Requesting data deletion, subject to certain exceptions.</li>
        </ul>
        <p className="mt-3">To exercise your rights, please contact us directly.</p>
      </section>

      <section className="mb-6">
        <h2 className="text-2xl font-semibold mb-3">Security</h2>
        <p>
          We implement security measures to protect your data, but no system is entirely secure. We encourage
          users to safeguard their information.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-2xl font-semibold mb-3">Changes to This Policy</h2>
        <p>
          We may update this policy and will notify users of significant changes. We encourage you to review
          this policy periodically.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-2xl font-semibold mb-3">Contact Us</h2>
        <p>
          If you have questions or concerns about our privacy practices, please contact us at
          support@automod.sh.
        </p>
      </section>
    </div>
  );
};

export default PrivacyPolicy;
