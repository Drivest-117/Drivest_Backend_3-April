Estrutura de Permissões e Consentimento
Permissões móveis, consentimento opcional e modelo de registo da Drivest
Versão
Versão 1.1
Última atualização
5 de abril de 2026
Preparado para
Drivest Limited

Objetivo do documento
Este documento interno define como as permissões e o consentimento devem agora ser solicitados na aplicação, para que o percurso móvel permaneça com baixo atrito, legalmente defensável e consistente com o website atual, o comportamento da aplicação e o modelo de registo do backend.

1. Objetivo deste documento
Este documento estabelece a estrutura atual de permissões e consentimento para a Drivest. Destina-se a manter a experiência móvel utilizável, permanecendo alinhada com a posição legal, de privacidade e da loja de aplicações ativa.
O princípio central permanece o mesmo. A Drivest deve solicitar apenas as permissões que sejam necessárias, deve solicitá-las em contexto, não deve pré-ativar escolhas opcionais e deve ser capaz de provar o que o utilizador escolheu e quando.

2. Modelo atual de permissões de integração
A Drivest utiliza agora um modelo de integração em duas fases.

A Fase 1 gere a aceitação legal obrigatória. Cobre:
- Aceitação dos Termos e Condições
- Aceitação da Política de Privacidade
- Confirmação de idade
- Reconhecimento do aviso de segurança

A Fase 2 gere as permissões operacionais e o consentimento opcional. Apresenta:
- Acesso à localização
- Escolha de análise
- Escolha de notificações

A localização é operacionalmente importante para funcionalidades relacionadas com rotas e estacionamento, mas continua a ser uma permissão do sistema operativo. As análises são opcionais. As notificações são opcionais.

3. Fase de aceitação legal obrigatória
A primeira fase de integração deve deixar claro que a Drivest é uma plataforma de suporte à condução que fornece apenas orientações.
Deve deixar claro que a Drivest não substitui o julgamento do utilizador, um instrutor de condução ou a lei.
A fase deve fornecer acesso aos Termos e Condições e à Política de Privacidade antes de o utilizador continuar.
O utilizador deve marcar ativamente uma caixa antes de continuar.
A aplicação não deve continuar até que essa caixa de seleção seja selecionada.
A mesma fase captura a confirmação de idade e o reconhecimento de segurança como parte do evento de aceitação.
O backend deve armazenar a versão dos termos aceites, versão da privacidade, versão da segurança, carimbo temporal de aceitação, ecrã de origem, versão da aplicação, plataforma e identificador de instalação, onde disponível.

4. Permissão de localização
A localização deve ser solicitada através de uma ação em contexto e, em seguida, através do diálogo de permissão do sistema operativo.
A redação explicativa deve manter-se consistente com a posição de privacidade atual:
- a localização é utilizada para rotas e navegação quando ativas
- as funcionalidades de rota e estacionamento necessitam de localização quando o utilizador tenta utilizá-las
- a Drivest não deve sugerir que o histórico de localização contínua em segundo plano é armazenado nos servidores

Se um utilizador recusar a permissão de localização, a aplicação pode restringir as funcionalidades relacionadas com rotas e estacionamento, mas não deve bloquear funcionalidades de aprendizagem não relacionadas.
A aplicação deve armazenar a escolha de localização efetiva do utilizador como uma de:
- permitir
- negar
- saltar

5. Consentimento de análises
As análises devem permanecer opcionais onde o consentimento seja a base legal pretendida.
O comportamento das análises deve permanecer desativado até que o utilizador faça uma escolha afirmativa.
A interface do utilizador deve descrever as análises como ajudando a melhorar o desempenho e a fiabilidade.
A interface não deve sugerir que as análises são necessárias para utilizar o serviço principal.
O backend deve armazenar:
- analyticsChoice
- carimbo temporal
- superfície de origem
- versão da aplicação
- plataforma
- identificador de instalação, onde disponível

6. Consentimento de notificações
As notificações devem permanecer opcionais.
O prompt deve descrever o seu objetivo operacional, incluindo atualizações, reservas, lembretes e atividade de conta importante, onde relevante.
As notificações não devem ser pré-ativadas por defeito.
A aplicação deve armazenar a escolha de preferência na aplicação do utilizador separadamente do resultado da permissão do sistema operativo.
O backend deve armazenar:
- notificationsChoice
- carimbo temporal
- superfície de origem
- versão da aplicação
- plataforma
- identificador de instalação, onde disponível

7. Requisitos de registo
O sistema deve registar o evento de aceitação legal separadamente das escolhas de permissão e consentimento.
No mínimo, o backend deve armazenar:
- versão dos termos
- versão da privacidade
- versão da segurança
- carimbo temporal de aceitação
- estado da confirmação de idade
- escolha de análise
- carimbo temporal da análise
- escolha de notificações
- carimbo temporal das notificações
- escolha de localização
- carimbo temporal da localização
- ecrã de origem ou superfície de origem
- versão da aplicação
- plataforma
- identificador de instalação, onde disponível

8. Requisito de implementação atual
A estrutura de permissões deve corresponder ao comportamento real da aplicação.
Se o fluxo legal descreve as análises como opcionais, as análises devem ser efetivamente opcionais na implementação.
Se a aplicação armazena a escolha de localização como parte da integração, esse modelo de dados deve estar refletido na documentação de conformidade interna.
Se a aplicação adicionar posteriormente uma nova permissão, um novo comportamento de monitorização ou processamento de localização contínua em segundo plano, a estrutura de permissões, a política de privacidade, o texto na aplicação e as declarações da loja devem ser todos atualizados em conjunto antes do lançamento.

9. Inventário final de permissões
Permissão ou escolha
Posição final

Reconhecimento legal combinado obrigatório
Aceitação dos Termos, aceitação da Privacidade, confirmação de idade e reconhecimento de segurança. Necessário antes que o utilizador possa entrar no produto.

Localização
Solicitada em contexto para apoiar rotas, navegação e funcionalidades dependentes da localização. Controlada pelo sistema operativo, mas a aplicação também armazena um estado de escolha registado.

Análises
Consentimento opcional. Deve permanecer desativado até que o utilizador faça uma escolha afirmativa.

Notificações
Consentimento opcional. Não deve ser pré-ativado. As definições do dispositivo continuam a ser a autoridade final de permissão, enquanto a aplicação armazena a escolha de preferência na aplicação do utilizador.
