# Supabase Email Configuration Guide

## 🚨 Issue: Password Reset Emails Not Being Received

Password reset emails require proper email configuration in Supabase. Here's how to set it up:

---

## 📧 **Option 1: Use Supabase Built-in Email (Development)**

Supabase provides a built-in email service for development, but emails may not be delivered reliably.

### **How to Check Email Logs:**

1. Go to your Supabase Dashboard: https://supabase.com/dashboard/project/utuafbxaxvetxcvtxqrv
2. Navigate to **Authentication** → **Email Templates**
3. Check **Logs** section to see if emails were sent

### **Development Workaround:**

In development, you can access the reset link directly from Supabase:

1. Go to **Authentication** → **Users**
2. Find the user who requested password reset
3. Click **"Send Magic Link"** or **"Send Password Recovery"**
4. Copy the link from the Supabase logs

---

## 📧 **Option 2: Configure Custom SMTP (Production)**

For production, you MUST configure a custom SMTP provider.

### **Step 1: Get SMTP Credentials**

Choose a provider:
- **SendGrid** (Recommended) - Free tier: 100 emails/day
- **Mailgun** - Free tier: 5,000 emails/month
- **AWS SES** - Very cheap, requires domain verification
- **Gmail SMTP** - Simple for testing, not for production

### **Step 2: Configure in Supabase**

1. Go to: https://supabase.com/dashboard/project/utuafbxaxvetxcvtxqrv/settings/auth
2. Scroll to **SMTP Settings**
3. Enable **"Enable Custom SMTP"**
4. Fill in your SMTP details:

```
Host: smtp.sendgrid.net (or your provider)
Port: 587
Username: apikey (for SendGrid)
Password: YOUR_SENDGRID_API_KEY
Sender Email: noreply@yourapp.com
Sender Name: WhisprSpace
```

5. Click **Save**

### **Step 3: Verify Domain (Optional but Recommended)**

1. Add SPF record to your DNS:
   ```
   v=spf1 include:sendgrid.net ~all
   ```

2. Add DKIM records (provided by your email provider)

---

## 🔧 **Option 3: Development Mode - Show Reset Link Directly**

For development, I've added a feature to show the reset link directly in the UI instead of sending email.

### **Enable Development Mode:**

Add to your `.env.local`:
```env
NEXT_PUBLIC_DEV_MODE=true
```

This will:
- Show the password reset link directly on screen
- Copy link to clipboard automatically
- Skip email sending in development

---

## 📝 **SendGrid Setup (Recommended for Production)**

### **Step 1: Create SendGrid Account**
1. Go to: https://signup.sendgrid.com/
2. Sign up (free tier available)
3. Verify your email

### **Step 2: Create API Key**
1. Go to **Settings** → **API Keys**
2. Click **Create API Key**
3. Name: "WhisprSpace Password Reset"
4. Permissions: **Full Access** (or just Mail Send)
5. Copy the API key (starts with `SG.`)

### **Step 3: Verify Sender Identity**
1. Go to **Settings** → **Sender Authentication**
2. Option A: **Single Sender Verification** (quick, for testing)
   - Add email: `noreply@yourdomain.com`
   - Verify via email
3. Option B: **Domain Authentication** (recommended for production)
   - Add DNS records to your domain
   - Improves deliverability

### **Step 4: Add to Supabase**
```
Host: smtp.sendgrid.net
Port: 587
Username: apikey
Password: SG.your-api-key-here
Sender Email: noreply@yourdomain.com (verified email)
Sender Name: WhisprSpace
```

---

## 🎨 **Customize Email Templates**

1. Go to: https://supabase.com/dashboard/project/utuafbxaxvetxcvtxqrv/auth/templates
2. Select **"Reset Password"** template
3. Customize the HTML/text

### **Default Variables Available:**
- `{{ .Token }}` - Reset token
- `{{ .TokenHash }}` - Hashed token
- `{{ .SiteURL }}` - Your app URL
- `{{ .ConfirmationURL }}` - Full reset link
- `{{ .Email }}` - User's email

### **Example Template:**
```html
<h2>Reset Your Password</h2>
<p>Hi there,</p>
<p>We received a request to reset your WhisprSpace password.</p>
<p>Click the button below to create a new password:</p>
<a href="{{ .ConfirmationURL }}" style="background: #7E22CE; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
  Reset Password
</a>
<p>If you didn't request this, you can safely ignore this email.</p>
<p>This link expires in 1 hour.</p>
```

---

## ✅ **Quick Test Checklist**

After configuration:

1. ✅ SMTP settings saved in Supabase
2. ✅ Sender email verified
3. ✅ Test email template updated
4. ✅ Request password reset from your app
5. ✅ Check spam folder
6. ✅ Verify reset link works

---

## 🐛 **Troubleshooting**

### **Email Not Received:**
- Check Supabase Auth logs: Dashboard → Authentication → Logs
- Verify SMTP credentials are correct
- Check spam/junk folder
- Verify sender email is authenticated
- Check rate limits (max 4 emails/hour per user by default)

### **"Email rate limit exceeded":**
- Wait 1 hour
- Or adjust rate limits in Supabase Auth settings

### **Reset Link Doesn't Work:**
- Links expire after 1 hour
- Check URL matches `NEXT_PUBLIC_APP_URL` in env
- Verify `redirectTo` parameter in code

### **Still Not Working:**
- Use Development Mode (Option 3)
- Check Supabase logs for errors
- Contact Supabase support

---

## 📱 **For Testing (No Email Required)**

If you just want to test the password reset flow without email:

1. Go to Supabase Dashboard → Authentication → Users
2. Find the user
3. Click "..." → "Send Password Recovery"
4. Copy the link from the logs
5. Open it in your browser
6. Complete password reset

---

## 🔒 **Security Notes**

- Reset links expire after 1 hour
- Maximum 4 reset requests per hour per user
- Tokens are single-use only
- Always use HTTPS in production
- Never expose service role key

---

## 📞 **Need Help?**

1. Supabase Discord: https://discord.supabase.com
2. Supabase Docs: https://supabase.com/docs/guides/auth/auth-email
3. Check your Supabase project logs for detailed errors
