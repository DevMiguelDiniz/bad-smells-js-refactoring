# Detecção de Bad Smells e Refatoração Segura

**Disciplina:** Teste de Software
**Aluno:** Miguel Figueiredo Diniz
**Matrícula:** 853959
**Repositório:** https://github.com/DevMiguelDiniz/bad-smells-js-refactoring

---

## 1. Análise de Smells (análise manual)

Lendo `src/ReportGenerator.js` identifiquei três Bad Smells principais.

**1) Long Method / complexidade ciclomática alta.** O método `generateReport` concentra cabeçalho, filtragem por perfil, cálculo de prioridade, formatação das linhas, soma do total e rodapé, com `for` e `if/else` aninhados em até 4 níveis. Na manutenção, qualquer alteração exige entender o método inteiro. Nos testes, o número de caminhos (tipo de relatório × perfil × valor do item) cresce de forma multiplicativa, e as unidades de lógica não podem ser testadas isoladamente.

**2) Código duplicado (Duplicated Code).** As linhas CSV e HTML e o `total += item.value` aparecem repetidos nos ramos ADMIN e USER, e o teste `reportType === 'CSV'` / `'HTML'` se repete no cabeçalho, no corpo (duas vezes) e no rodapé. Uma mudança de formato precisa ser feita em vários lugares, com risco de divergência, e cada cópia exige cobertura própria.

**3) Condicionais complexas e Números Mágicos.** As cadeias de `if/else` por tipo de relatório e por perfil violam o princípio aberto/fechado: um novo formato (ex.: JSON) ou perfil obriga a editar o método e re-testar tudo. Os literais `1000` (limite de prioridade), `500` (limite do usuário comum) e as strings `'ADMIN'`, `'USER'`, `'CSV'`, `'HTML'` não têm nome, então a intenção é implícita. Há ainda um efeito colateral: o método **muta** o item recebido (`item.priority = true`).

## 2. Relatório da Ferramenta (ESLint + SonarJS)

Configuração: `.eslintrc.json` com `eslint:recommended` e `plugin:sonarjs/recommended`. O repositório usa o limite de complexidade cognitiva **5** (o enunciado sugere 15). Saída de `npx eslint src/` **antes** da refatoração (arquivo `relatorio/eslint_antes.txt`):

```
src\ReportGenerator.js
  11:3   error  Refactor this function to reduce its Cognitive Complexity from 27 to the 5 allowed  sonarjs/cognitive-complexity
  43:14  error  Merge this if statement with the nested one                                         sonarjs/no-collapsible-if

✖ 2 problems (2 errors, 0 warnings)
```

O SonarJS quantificou o que na leitura manual era apenas uma impressão: a complexidade cognitiva é **27** contra um limite de 5, ponderando o aninhamento (cada nível extra pesa mais), algo difícil de estimar a olho. Também apontou um `if` colapsável (linha 43: `else if (user.role === 'USER') { if (item.value <= 500) ...`) que passa despercebido por parecer uma regra de negócio legítima. Por outro lado, a ferramenta **não** detectou números mágicos nem a mutação do parâmetro, achados apenas na análise manual. As duas abordagens são complementares.

## 3. Processo de Refatoração

O smell mais crítico é o Long Method com condicionais aninhadas e duplicação (complexidade 27).

**Antes** (trecho do corpo):

```js
for (const item of items) {
  if (user.role === 'ADMIN') {
    if (item.value > 1000) { item.priority = true; }
    if (reportType === 'CSV') {
      report += `${item.id},${item.name},${item.value},${user.name}\n`;
      total += item.value;
    } else if (reportType === 'HTML') {
      const style = item.priority ? 'style="font-weight:bold;"' : '';
      report += `<tr ${style}><td>...</td></tr>\n`;
      total += item.value;
    }
  } else if (user.role === 'USER') {
    if (item.value <= 500) {
      if (reportType === 'CSV') { /* ...duplicado... */ }
      else if (reportType === 'HTML') { /* ...duplicado... */ }
    }
  }
}
```

**Depois** (`src/ReportGenerator.refactored.js`):

```js
generateReport(reportType, user, items) {
  const formatter = formatters[reportType] ?? emptyFormatter;
  const visibleItems = this.selectVisibleItems(user, items);

  this.markPriorityItems(user, visibleItems);

  const total = visibleItems.reduce((sum, item) => sum + item.value, 0);
  const rows = visibleItems.map((item) => formatter.row(item, user));

  return [formatter.header(user), ...rows, formatter.footer(total)]
    .join('').trim();
}
```

Técnicas aplicadas:

- **Extract Method:** `selectVisibleItems` e `markPriorityItems` isolam filtragem e regra de prioridade.
- **Replace Conditional with Polymorphism (Strategy):** `csvFormatter` e `htmlFormatter` expõem a mesma interface (`header`, `row`, `footer`); o `if/else` por tipo virou uma busca em tabela (`formatters[reportType]`). Novo formato = novo objeto, sem editar o método.
- **Decompose Conditional / tabela de regras:** `visibilityRules` mapeia perfil → predicado.
- **Replace Magic Number with Symbolic Constant:** `PRIORITY_THRESHOLD`, `USER_MAX_VALUE`, `ROLE_ADMIN`, `ROLE_USER`.
- **Eliminação de duplicação:** formatação e soma do total ocorrem uma única vez.

O comportamento para entradas inesperadas foi preservado (tipo desconhecido gera relatório vazio; perfil desconhecido gera relatório sem itens).

## 4. Validação

`tests/ReportGenerator.refactored.test.js` é cópia do teste original, alterando **apenas** o import. Resultado de `npm test` (`relatorio/jest_saida.txt`):

| Suíte | Resultado |
|---|---|
| `ReportGenerator.refactored.test.js` | **5/5 passam** |
| `ReportGenerator.test.js` (original) | 4/5 passam |

`npx eslint src/ReportGenerator.refactored.js`: **0 erros** (antes: 2 erros, complexidade 27).

**Observação importante:** o teste original *já falhava antes de qualquer alteração* ("HTML completo para Admin"). O código original gera `<tr >` (com espaço, vindo de `<tr ${style}>` quando `style` é vazio), mas o teste espera `<tr><td>1</td>...`. É um bug latente do código original, não uma regressão. A versão refatorada gera `<tr>` e `<tr style="font-weight:bold;">`, passando em todos os testes. Conforme a regra do trabalho, o arquivo e o teste originais não foram modificados.

## 5. Conclusão

A suíte de testes funcionou como rede de segurança: validou o comportamento externo (saída CSV/HTML, filtros, totais) e permitiu reescrever a estrutura interna com confiança, além de revelar um bug preexistente (`<tr >`) que a leitura do código não evidenciava. A redução dos smells (complexidade cognitiva 27 → abaixo do limite, duplicação removida, constantes nomeadas) torna o código mais legível, mais fácil de estender (novos formatos e perfis) e mais testável, pois cada parte (formatter, regra de visibilidade, prioridade) pode ser testada isoladamente.
