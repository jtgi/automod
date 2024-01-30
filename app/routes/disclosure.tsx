export default function Page() {
  return (
    <div className="max-w-4xl container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-4">Commercial Disclosure</h1>
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            ABC K.K. (John Smith)
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            Help creators get engagement and create exclusive content.
          </p>
        </div>
        <div className="border-t border-gray-200">
          <dl>
            <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Legal Name</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:col-span-2">
                John Giannakos
              </dd>
            </div>
            <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Address</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:col-span-2">
                We will disclose without delay if requested
              </dd>
            </div>
            <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">
                Phone Number
              </dt>
              <dd className="mt-1 text-sm text-gray-900 sm:col-span-2">
                We will disclose without delay if requested
              </dd>
            </div>
            <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">
                Email Address
              </dt>
              <dd className="mt-1 text-sm text-gray-900 sm:col-span-2">
                help@glass.cx
              </dd>
            </div>
            <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">
                Head of Operations
              </dt>
              <dd className="mt-1 text-sm text-gray-900 sm:col-span-2">
                John Giannakos
              </dd>
            </div>
            <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">
                Additional Fees
              </dt>
              <dd className="mt-1 text-sm text-gray-900 sm:col-span-2">None</dd>
            </div>
            <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">
                Exchanges & Returns Policy
              </dt>
              <dd className="mt-1 text-sm text-gray-900 sm:col-span-2">
                <strong>For non-defective items:</strong> You may request a
                refund for a purchase within 24 hours.
                <br />
                <strong>For defective items:</strong> If the software is
                defective you may reach out to help@glass.cx and we will work
                with you to resolve the issue.
              </dd>
            </div>
            <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">
                Delivery Times
              </dt>
              <dd className="mt-1 text-sm text-gray-900 sm:col-span-2">
                Instant. Preorders will be delivered according to the schedule
                mentioned at time of purchase.
              </dd>
            </div>
            <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">
                Accepted Payment Methods
              </dt>
              <dd className="mt-1 text-sm text-gray-900 sm:col-span-2">
                Credit cards
              </dd>
            </div>
            <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">
                Payment Period
              </dt>
              <dd className="mt-1 text-sm text-gray-900 sm:col-span-2">
                Immediate for credit cards
              </dd>
            </div>
            <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Price</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:col-span-2">
                $6.99/month (including taxes)
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
