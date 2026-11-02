const ROLE_ADMIN = 'ADMIN';
const ROLE_USER = 'USER';

const PRIORITY_THRESHOLD = 1000;
const USER_MAX_VALUE = 500;

const visibilityRules = {
  [ROLE_ADMIN]: () => true,
  [ROLE_USER]: (item) => item.value <= USER_MAX_VALUE,
};

const csvFormatter = {
  header: () => 'ID,NOME,VALOR,USUARIO\n',
  row: (item, user) => `${item.id},${item.name},${item.value},${user.name}\n`,
  footer: (total) => `\nTotal,,\n${total},,\n`,
};

const htmlFormatter = {
  header: (user) =>
    '<html><body>\n' +
    '<h1>Relatório</h1>\n' +
    `<h2>Usuário: ${user.name}</h2>\n` +
    '<table>\n' +
    '<tr><th>ID</th><th>Nome</th><th>Valor</th></tr>\n',
  row: (item) => {
    const style = item.priority ? ' style="font-weight:bold;"' : '';
    return `<tr${style}><td>${item.id}</td><td>${item.name}</td><td>${item.value}</td></tr>\n`;
  },
  footer: (total) =>
    '</table>\n' + `<h3>Total: ${total}</h3>\n` + '</body></html>\n',
};

const formatters = {
  CSV: csvFormatter,
  HTML: htmlFormatter,
};

const emptyFormatter = {
  header: () => '',
  row: () => '',
  footer: () => '',
};

export class ReportGenerator {
  constructor(database) {
    this.db = database;
  }

  /**
   * Gera um relatório de itens baseado no tipo e no usuário.
   * - Admins veem tudo.
   * - Users comuns só veem itens com valor <= 500.
   */
  generateReport(reportType, user, items) {
    const formatter = formatters[reportType] ?? emptyFormatter;
    const visibleItems = this.selectVisibleItems(user, items);

    this.markPriorityItems(user, visibleItems);

    const total = visibleItems.reduce((sum, item) => sum + item.value, 0);
    const rows = visibleItems.map((item) => formatter.row(item, user));

    return [formatter.header(user), ...rows, formatter.footer(total)]
      .join('')
      .trim();
  }

  selectVisibleItems(user, items) {
    const isVisible = visibilityRules[user.role];
    return isVisible ? items.filter(isVisible) : [];
  }

  markPriorityItems(user, items) {
    if (user.role !== ROLE_ADMIN) return;

    items
      .filter((item) => item.value > PRIORITY_THRESHOLD)
      .forEach((item) => {
        item.priority = true;
      });
  }
}
