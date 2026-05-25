import { Body, Button, Container, Head, Heading, Html, Link, Text } from '@react-email/components';

interface ResetPasswordEmailProps {
  userName: string;
  resetUrl: string;
}

export function ResetPasswordEmail({ userName, resetUrl }: ResetPasswordEmailProps) {
  return (
    <Html lang="zh-CN">
      <Head />
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Heading as="h2" style={headingStyle}>
            Hi {userName},重置你的密码
          </Heading>
          <Text style={paragraphStyle}>
            收到这封邮件是因为有人申请重置你的账号密码。点下面的按钮就可以设置新密码,链接 1 小时内有效。
          </Text>
          <Button href={resetUrl} style={buttonStyle}>
            重置密码
          </Button>
          <Text style={paragraphStyle}>
            按钮点不开的话,可以复制下面这个链接到浏览器打开:
          </Text>
          <Text style={paragraphStyle}>
            <Link href={resetUrl} style={linkStyle}>
              {resetUrl}
            </Link>
          </Text>
          <Text style={paragraphStyle}>
            如果不是你本人申请的,请忽略此邮件,你的账号是安全的。
          </Text>
          <Text style={paragraphStyle}>—— 纸片人男友</Text>
        </Container>
      </Body>
    </Html>
  );
}

export default ResetPasswordEmail;

const bodyStyle = {
  fontFamily: 'sans-serif',
  backgroundColor: '#fafafa',
  padding: '24px 0',
};

const containerStyle = {
  maxWidth: '500px',
  margin: '0 auto',
  backgroundColor: '#ffffff',
  padding: '24px',
  borderRadius: '8px',
};

const headingStyle = {
  fontSize: '20px',
  color: '#222',
};

const paragraphStyle = {
  fontSize: '15px',
  lineHeight: '1.6',
  color: '#333',
};

const linkStyle = {
  color: '#5865F2',
  textDecoration: 'underline',
  wordBreak: 'break-all' as const,
};

const buttonStyle = {
  backgroundColor: '#222',
  color: '#fff',
  padding: '12px 24px',
  borderRadius: '6px',
  textDecoration: 'none',
  display: 'inline-block',
  margin: '12px 0',
  fontSize: '15px',
};
