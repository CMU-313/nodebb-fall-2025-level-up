# User Guide for New Features

## Overview
This guide explains how to use and test the new **Instructor Tagline**, **Anonymous Post**, and **Private Post** features implemented in this version of the application. These additions enhance user differentiation, privacy, and control within the discussion forum.

---

## Instructor Tagline Feature

### Purpose
The Instructor Tagline feature automatically adds a custom “Instructor” label next to administrator or instructor accounts in topic views. This helps distinguish posts made by instructors from those made by regular users.

### How to Use
1. Log in as an administrator or instructor (a user who belongs to the `administrators` group).
2. Create a new topic in any category.
3. The topic author’s information will include an “Instructor” tagline next to the username when viewed in:
   - Topic lists
   - Category pages
   - Topic detail views

Regular (non-admin) users will **not** have this tagline displayed.

### How to Test
1. Log in as an administrator and post a new topic.
2. View the topic from the category or recent topics page.
3. Confirm that the instructor tagline is visible in the topic’s user profile information.
4. Log in as a regular user, create a topic, and confirm that no tagline appears.

---

## Anonymous Post Feature

### Purpose
The Anonymous Post functionality allows users to create topics or replies that hide their identity from other users. Posts will appear under an anonymized identifier while maintaining internal user ownership for moderation purposes.

### How to Use
1. When creating a topic or reply, enable the **Anonymous** option in the post creation UI (if available).
2. Once submitted, the post will no longer display the author’s username.

### How to Test
1. Log in as a regular user.
2. Create a post with the “Anonymous” option enabled.
3. Verify that the post displays under an anonymous name when viewed by other users.

---

## Private Post Feature

### Purpose
Private posts and topics allow users or staff to create discussions that are hidden from public view. Only administrators, moderators, and the topic owner can view and interact with private topics.

### How to Use
1. When creating a new topic, select the **Private** option.
2. Private topics will not appear in:
   - Category topic lists (for non-staff users)
   - Recent topics
   - Popular topics
   - Suggested topics
   - The user profile
3. The topic owner and staff users retain full visibility and interaction rights.

### Visibility Rules
| User Type           | Can See Private Topics | Can Create Private Topics | Can Reply to Private Topics |
|----------------------|------------------------|----------------------------|-----------------------------|
| Administrator        | Yes                    | Yes                        | Yes                         |
| Moderator            | Yes                    | Yes                        | Yes                         |
| Topic Owner          | Yes (own only)         | Yes                        | Yes (own only)              |
| Regular Student/User | No                     | Yes (own only)             | No                          |

### How to Test
1. Log in as an admin and create a private topic.
2. Log in as a student and confirm that the topic does not appear in public views.
3. Attempt to access the private topic via URL as a non-staff user; it should return a 403 error.
4. Verify that the topic owner can still access and reply to their own private topic.

---

## Automated Tests

### Location
Automated tests for these features are located in:
- test/topics.js
- test/posts.js

### What Is Tested
- **Instructor Tagline**
  - Tagline appears for admin users in topic and category views.
  - Tagline does not appear for regular users.
  - Tagline information is properly populated in `custom_profile_info`.

- **Private Posts**
  - Private topics are hidden from non-staff users.
  - Admins and moderators have full visibility and access.
  - Topic owners can access and interact with their own private topics.
  - Private topics are correctly filtered from recent, popular, and suggested topic lists.
  - Private flags persist through topic creation, deletion, and reply workflows.

- **Anonymous Posts**
  - Anonymous flag properly hides the author’s identity from other users.
  - Original author remains visible to moderators and administrators only.
  - Anonymous posts retain correct ownership metadata internally.
  - Anonymous replies and topics are handled consistently across category, recent, and profile views.

### Test Coverage Justification
The automated tests cover:
- Visibility logic for each user role (admin, moderator, regular user, topic owner).
- Access control at both the API and UI levels.
- Correct persistence and retrieval of privacy and instructor-related fields.
- End-to-end behavior for topic creation, listing, and permission checks.

This comprehensive set of tests ensures functional correctness and guards against regressions in user visibility and tagging logic.

---

