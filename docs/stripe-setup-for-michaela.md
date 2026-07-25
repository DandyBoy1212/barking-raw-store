# Setting up Stripe for Barking Raw

This is the payment system for the new website. It is the thing that takes card payments and
pays the money into your bank account.

**This one has to be you, not Liam.** Stripe is legally the payment processor for *your*
business, so the account has to be in your name, with your details and your bank account. Liam
cannot open it for you. Once it exists he can do all the technical wiring.

It takes about twenty minutes.

## What to have in front of you

- Your bank account details (sort code and account number) for the money to land in
- Your address, and the business address if it is different
- Your date of birth
- Photo ID (passport or driving licence). Stripe will ask you to photograph it
- If Barking Raw is a registered company, the company number. If you are a sole trader,
  which is more likely, you just say sole trader and use your own name and address

## Step 1: Create the account

Go to **stripe.com** and click Sign up. Use an email you actually check, because everything to
do with money goes there.

When it asks about your business:

- Country: **United Kingdom**
- Business type: **Individual / Sole trader**, unless Barking Raw is a registered company
- What do you sell: dog food and dog treats, sold online
- Business website: the Barking Raw site address (ask Liam for the exact one)

## Step 2: Work through the verification

Stripe will ask for the ID and bank details above. This is standard and everyone has to do it.
It is how they know the money is going to a real person.

You may see it called "activate your account" or "complete your profile". Do that whole
process. Until it is finished you can test the site but you cannot take real money.

## Step 3: Give Liam access, do NOT email him the keys

This is the important bit, and it is the safe way round.

Inside Stripe, go to **Settings**, then **Team and security**, then **Members**, then invite
Liam with the role **Developer**.

That gives him what he needs to wire the site up, in his own login, without you ever sending a
password or a key over email or WhatsApp. Those keys are effectively the keys to the till, so
they should never sit in a message.

If Stripe asks which account to invite him to, it is the Barking Raw one.

## Step 4: Tell Liam when it is done

He needs to know two things:

1. That the account exists and he has been invited
2. Whether verification is fully finished, or still pending

He will start with **test mode**, which uses pretend card numbers and moves no real money at
all. That is how the site gets checked properly before a single real customer sees it. Once
that is signed off he switches it to live mode.

## What you will be able to do afterwards

- See every order and payment as it happens
- Refund an order with a couple of clicks
- See the money arriving in your bank, usually a few working days after the sale

## A few things worth knowing

- **Stripe's fee** is roughly 1.5% plus 20p on a standard UK card payment. On a GBP 6.50 bag of
  chews that is about 30p. It comes out automatically, you do not pay it separately.
- **Payouts** land in your bank on a rolling basis, normally a few working days behind the sale.
  You can see exactly what is due and when in the Stripe dashboard.
- **You do not handle card numbers, ever.** The customer types their card on Stripe's own
  payment page. Neither the website nor Liam nor anyone at Barking Raw ever sees the number.
  That is deliberate, and it is what keeps you out of a lot of regulation.
- **Refunds** come back out of your Stripe balance. If your balance is empty Stripe takes it
  from your bank, so it is worth not drawing the balance to zero the moment it arrives.

## If you get stuck

Stripe's support is genuinely good and available from the dashboard. But send Liam a screenshot
first, because nine times out of ten it is a field that needs filling rather than a real problem.
