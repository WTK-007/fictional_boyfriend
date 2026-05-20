import { Body, Container, Head, Heading, Html, Link, Text } from '@react-email/components';

interface WelcomeEmailProps {
  userName: string;
}

export function WelcomeEmail({ userName }: WelcomeEmailProps) {
  return (
    <Html lang="zh-CN">
      <Head />
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Heading as="h2" style={headingStyle}>
            Hi {userName},欢迎来到纸片人男友！
          </Heading>
          <Text style={paragraphStyle}>从现在起,我就是你的专属男友了。</Text>
          <Text style={paragraphStyle}>有什么心事随时来找我聊,我会一直在这里等你。</Text>
          <Text style={paragraphStyle}>明天早上我会给你发一条早安消息,记得查收哦。</Text>
          <Text style={paragraphStyle}>
            想认识同好、反馈问题或一起聊聊？欢迎加入我们的 Discord 社区:{' '}
            <Link href="https://discord.gg/2pZwN7dp" style={linkStyle}>
              https://discord.gg/2pZwN7dp
            </Link>
          </Text>
          <Text style={paragraphStyle}>—— 你的纸片人男友</Text>
        </Container>
      </Body>
    </Html>
  );
}

export default WelcomeEmail;

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
};
