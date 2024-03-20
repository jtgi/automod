import React from "react";

export default function Disclosure() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-4">Commercial Disclosure (特定商取引法に基づく表記)</h1>

      <div className="space-y-3">
        <p>
          <strong>Legal Name:</strong> John G
        </p>
        <p>
          <strong>Address:</strong> (We will disclose without delay if requested for sole proprietors)
        </p>
        <p>
          <strong>Phone Number:</strong> (We will disclose without delay if requested for sole proprietors)
        </p>
        <p>
          <strong>Operating Hours:</strong> 10:00 - 16:00 JST (excluding weekends and holidays)
        </p>
        <p>
          <strong>Email Address:</strong> support@automod.sh
        </p>
        <p>
          <strong>Head of Operations:</strong> John G
        </p>

        <h2 className="text-xl font-semibold mt-6">Additional Fees</h2>
        <p>No additional fees for digital services.</p>

        <h2 className="text-xl font-semibold mt-6">Exchanges & Returns Policy</h2>
        <p>
          - <strong>Before Shipping:</strong> N/A
        </p>
        <p>
          - <strong>After Shipping:</strong> N/A
        </p>
        <p>
          - <strong>Defective Goods and Services:</strong> In case of any issues with the service, please
          contact our support center at support@automod.sh. We will address the issue promptly, offering
          solutions such as service credits or adjustments as appropriate.
        </p>

        <h2 className="text-xl font-semibold mt-6">Delivery Times</h2>
        <p>Service activation is immediate upon subscription confirmation.</p>

        <h2 className="text-xl font-semibold mt-6">Accepted Payment Methods</h2>
        <p>Credit Cards</p>

        <h2 className="text-xl font-semibold mt-6">Payment Period</h2>
        <p>- Credit card payments are processed immediately.</p>

        <h2 className="text-xl font-semibold mt-6">Price</h2>
        <p>Plan depending on number of channels and usage fees. Charged per month (inclusive of all taxes)</p>

        <h2 className="text-xl font-semibold mt-6">Optional Items</h2>
        <p>
          - <strong>Application Period:</strong> Subscription available year-round.
        </p>
        <p>
          - <strong>Available Quantity:</strong> Unlimited.
        </p>
        <p>
          - <strong>Operating Environment:</strong> Accessible on any device with internet connectivity and a
          web browser.
        </p>
      </div>
    </div>
  );
}
