import React from 'react';
import { Layout as AntLayout, Menu, type MenuProps } from 'antd';
import { DashboardOutlined, ScheduleOutlined, HistoryOutlined } from '@ant-design/icons';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';

const { Header, Sider, Content } = AntLayout;

type MenuItem = Extract<MenuProps['items'], Array<any>>[number] & { path?: string };

const menuItems: MenuItem[] = [
  {
    key: 'dashboard',
    icon: <DashboardOutlined />,
    label: '仪表盘',
    path: '/dashboard',
  },
  {
    key: 'jobs',
    icon: <ScheduleOutlined />,
    label: '任务管理',
    path: '/jobs',
  },
  {
    key: 'history',
    icon: <HistoryOutlined />,
    label: '执行历史',
    path: '/history',
  },
];

const Layout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const getSelectedKey = (): string => {
    const path = location.pathname;
    if (path.startsWith('/jobs')) return 'jobs';
    if (path.startsWith('/history')) return 'history';
    return 'dashboard';
  };

  const handleMenuClick = ({ key }: { key: string }) => {
    const item = menuItems.find((m) => m && 'key' in m && m.key === key);
    if (item && item.path) {
      navigate(item.path);
    }
  };

  const getPageTitle = (): string => {
    const key = getSelectedKey();
    const item = menuItems.find((m) => m && 'key' in m && m.key === key);
    if (item && 'label' in item) {
      return item.label as string;
    }
    return '仪表盘';
  };

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Sider width={240} theme="dark">
        <div className="logo">任务调度平台</div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[getSelectedKey()]}
          items={menuItems}
          onClick={handleMenuClick}
        />
      </Sider>
      <AntLayout>
        <Header>
          <h1 className="page-title">{getPageTitle()}</h1>
        </Header>
        <Content>
          <Outlet />
        </Content>
      </AntLayout>
    </AntLayout>
  );
};

export default Layout;
