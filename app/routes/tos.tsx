// app/routes/terms-of-service.tsx
import { MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = () => [
  {
    title: "Terms of Service",
  },
];

const TermsOfService = () => {
  return (
    <div className="max-w-4xl mx-auto p-6 bg-white shadow rounded-lg">
      <h1 className="text-3xl font-bold text-center mb-6">Terms of Service</h1>

      <section className="mb-6">
        <h2 className="text-2xl font-semibold mb-3">Welcome!</h2>
        <p className="mb-3">
          Thank you for choosing our services. These terms govern your use of our services and products,
          aiming to ensure a positive and constructive environment for all users.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-2xl font-semibold mb-3">Using Our Services</h2>
        <p className="mb-3">By using our services, you agree to:</p>
        <ul className="list-disc pl-6">
          <li>Use them for lawful purposes and in a non-harmful manner to others.</li>
          <li>Respect the intellectual property rights of the content we provide.</li>
          <li>Not to misuse any part of our services, including unauthorized access or alterations.</li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="text-2xl font-semibold mb-3">Your Account</h2>
        <p className="mb-3">
          Some services may require an account. Keep your account information secure and notify us immediately
          of any unauthorized use.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-2xl font-semibold mb-3">Content on Our Services</h2>
        <p className="mb-3">Content you provide remains yours.</p>
      </section>

      <section className="mb-6">
        <h2 className="text-2xl font-semibold mb-3">Our Rights</h2>
        <p className="mb-3">
          We reserve the right to modify or terminate services for any reason, without notice, at our
          discretion. We also reserve the right to remove content that we determine to be unlawful or
          offensive.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-2xl font-semibold mb-3">Disclaimers</h2>
        <p className="mb-3">
          Our services are provided "as is." We make no warranties regarding their reliability, availability,
          or ability to meet your needs. We disclaim all warranties to the extent permitted by law.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-2xl font-semibold mb-3">Liability</h2>
        <p className="mb-3">
          To the extent permitted by law, we shall not be liable for any indirect, incidental, special,
          consequential, or punitive damages, or any loss of profits or revenues, whether incurred directly or
          indirectly.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-2xl font-semibold mb-3">Modifications to Terms</h2>
        <p className="mb-3">
          We may modify these terms or any additional terms that apply to a service. You should look at the
          terms regularly. We’ll post notice of modifications to these terms on this page.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-2xl font-semibold mb-3">Contact Us</h2>
        <p>
          If you have any questions or concerns about these terms, please contact us at support@automod.sh.
        </p>
      </section>
    </div>
  );
};

export default TermsOfService;
