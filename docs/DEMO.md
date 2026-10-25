# FixMate demonstration guide

## Prepare

Run `npm run demo` from the project root. Wait until the API is ready. Open `http://localhost:5173`. Read `.data/demo-accounts.txt` for the generated password. Use a single browser and sign out between roles, or use separate browser profiles: tabs in one profile share the same session cookie.

The seed includes a customer with two appliances, a verified shop, a pending shop, a completed service with inspection/quotation/history, an example review, and approved sample guidance. These are fictional. New actions in the following demonstration use real saved records.

## Customer: understand and request

1. Open the homepage and let the short intro finish, or skip it. Scroll through the appliance cards, component explorer, process, and sample journey.
2. Sign in at `/customer/login` as `customer@fixmate.demo`.
3. Open **My appliances**. Inspect the seeded washer/refrigerator, or register a new supported appliance.
4. Open **Smart Assist** and enter: “My washing machine makes a loud noise during spinning.”
5. Show the approved sources and mode notice. Without Atlas/Ollama configuration, describe this honestly as approved-reference mode. The assistant does not claim to diagnose the fault.
6. Open **Find technicians**, filter to Washing machine and Bengaluru. The approved fictional shop appears; the pending shop does not.
7. Choose **Book an inspection**. Select the washer, enter symptoms, select Bengaluru and Green Circuit Repairs, enter an address and a future preferred appointment, then submit.
8. Note the repair ID. Open the timeline: status is REQUESTED.
9. Sign out.

## Technician: inspect and quote

10. Sign in at `/technician/login` as `technician@fixmate.demo`.
11. Open **New requests** and the same repair ID. Click **Accepted** with a note.
12. Move to **Inspection scheduled**. This step confirms the technician is arranging the requested appointment.
13. Record observed symptoms, findings, diagnosis, required parts, and estimated hours. Saving the inspection moves to INSPECTED.
14. Move to QUOTE_PENDING if desired; create the quotation from the inspection.
15. Enter itemized inspection, parts, labor, and tax amounts. Set a future validity date and a later estimated completion date. Send the quotation.
16. Explain that starting billable work is unavailable until the customer approves. Sign out.

## Customer: make the decision

17. Sign in as the customer, open **Quotes & approvals**, and open the same request.
18. Review the diagnosis, line items, total, validity, and cost chart.
19. Optionally ask a clarification question. It appears in the technician’s Messages/Notifications and on the quote.
20. Approve the quotation. The timeline moves to QUOTE_APPROVED. Alternatively reject it to demonstrate revised quotes retaining earlier history.
21. Sign out.

## Technician: complete the authorized work

22. Sign in as the technician and reopen the request.
23. Move to REPAIR_IN_PROGRESS.
24. Record work performed, replaced parts, and final charges. The server rejects charges above the approved total.
25. Mark the repair complete and then READY_FOR_COLLECTION.
26. Sign out. Sign in as the customer, confirm collection and close the repair, then submit a review.

## Administrator: oversee

27. Sign in at `/admin/login` as `admin@fixmate.demo`.
28. Show database-backed metrics and charts; the new completed service is included.
29. Open **Technician verification**. Review HomeSpark Workshop and record an approval/rejection reason. Seeded fictional shops have an explicit document exemption; real registrations require verification uploads.
30. Open **Repair shop management**. Suspend/reactivate a shop or unpublish a service. Suspended shops disappear from discovery and cannot progress repairs.
31. Open **Appliance categories**. Edit or disable a category. New bookings cannot use disabled categories.
32. Open **Audit logs** to show recorded decisions and lifecycle changes.
33. Optional: request a support investigation using the repair ID. It remains unreadable until the customer authorizes it from Profile. Return as admin and show the time-limited, logged access.

## Persistence demonstration

Stop the app with Ctrl+C and run `npm run demo` again. Sign in and open the same repair ID. Records, timeline, quote revisions, and reviews remain saved. Never delete `.data/mongo` to “restart” the demo.

## Live RAG demonstration

Use configured Atlas mode, install/pull Ollama models, provision vector indexes, approve documents, and rebuild embeddings as described in README. Confirm the response mode is `rag` and references are present. Local MongoDB alone does not implement Atlas `$vectorSearch`; reference mode remains available and is visibly labeled.
