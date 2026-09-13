import { registerNoticeAction } from '../../components/SystemNotices/noticeActions.js';

// Opens the new-trip creation modal on DashboardPage via URL param.
// DashboardPage reads ?create=1 on mount and calls setShowForm(true).
registerNoticeAction('open:trip-create', ({ navigate }) => {
  navigate('/dashboard?create=1');
});
