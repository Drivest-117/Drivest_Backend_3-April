Ecrãs Legais de Integração na Aplicação
Modelo de integração atual em duas fases
Versão
Versão 1.1
Última atualização
5 de abril de 2026
Preparado para
Drivest Limited

Objetivo do documento
Este documento interno define o fluxo de permissões e questões legais de integração atualmente aprovado para a Drivest. Reflete a implementação presente na aplicação e substitui redações anteriores que não descreviam totalmente o modelo de consentimento armazenado.

1. Objetivo
Este documento define o fluxo de integração atual na aplicação para aceitação legal e permissões. O modelo aprovado utiliza duas fases em vez de um percurso legal mais longo com múltiplos ecrãs. O objetivo é reduzir o atrito do utilizador, mantendo a captura de um reconhecimento legal válido e de escolhas registadas separadamente que podem ser aplicadas e comprovadas pelo backend.

2. Fase 1: Aceitação legal combinada
A Fase 1 é a porta de entrada obrigatória na aplicação.

Título atual:
Antes de começar

Corpo de texto atual:
A Drivest é uma plataforma de suporte à condução. Fornece apenas orientações e não substitui o seu julgamento, o seu instrutor ou a lei.

Deve seguir sempre os sinais de trânsito, as leis de trânsito e as condições do mundo real. Se algo na aplicação entrar em conflito com a estrada, siga a estrada.

Ao continuar, confirma que tem 16 anos de idade ou mais, que compreende e aceita o aviso de segurança e que concorda com os Termos e Condições e com a Política de Privacidade.

Controlos necessários:
- Ver Termos
- Ver Privacidade
- uma caixa de seleção obrigatória
- Botão Continuar desativado até que a caixa de seleção seja selecionada

Texto da caixa de seleção atual:
Confirmo que tenho 16 anos ou mais, compreendo o aviso de segurança e concordo com os Termos e Condições e com a Política de Privacidade.

Esta fase cria o registo de aceitação legal autoritário.
O backend deve armazenar:
- termsVersion (versão dos termos)
- privacyVersion (versão da privacidade)
- safetyVersion (versão da segurança)
- ageConfirmed (idade confirmada)
- safetyAccepted (segurança aceite)
- acceptance timestamp (carimbo temporal de aceitação)
- sourceScreen (ecrã de origem)
- app version (versão da aplicação)
- platform (plataforma)
- install identifier (identificador de instalação, onde disponível)

3. Fase 2: Permissões e consentimento opcional
A Fase 2 é o ecrã de permissões operacionais.

Título atual:
Permissões

Corpo de texto atual:
A Drivest precisa de certas permissões para funcionar corretamente. A localização é utilizada para rotas e navegação quando ativas. As análises ajudam a melhorar o desempenho e a fiabilidade e são opcionais. As notificações mantêm-no atualizado sobre reservas e atividade.

Controlos necessários:
- uma ação de localização que acione o fluxo de permissão de localização nativo do sistema operativo
- ações separadas de permitir e não permitir análises
- ações separadas de ativar e agora não para notificações
- Botão Continuar

Secção de localização atual:
Título: Localização
Mensagem: A localização é utilizada para rotas e navegação quando ativas.
Botão: Solicitar acesso à localização

Estados de estado de localização atuais:
- O acesso à localização já é permitido para a Drivest.
- O acesso à localização está atualmente negado. Pode continuar, mas as funcionalidades de rota permanecerão limitadas até que o ative.
- A localização é opcional por agora, mas as funcionalidades de rota e estacionamento necessitam dela quando as utiliza.

Secção de análises atual:
Título: Análises Opcionais
Mensagem: As análises ajudam a melhorar o desempenho e a fiabilidade e são opcionais.
Ações:
- Permitir Análises
- Não Permitir

Secção de notificações atual:
Título: Notificações Opcionais
Mensagem: As notificações mantêm-no atualizado sobre reservas e atividade.
Ações:
- Ativar Notificações
- Agora Não

4. Mapeamento do backend
No mínimo, a Fase 1 deve criar ou atualizar registos em:
- legal_document_versions
- user_legal_acceptances

No mínimo, a Fase 2 deve criar ou atualizar registos de escolha atual e de histórico para:
- analyticsChoice
- notificationsChoice
- locationChoice

Alterações posteriores nas definições devem ser escritas de volta no mesmo modelo de conformidade do backend para que a Drivest possa provar tanto a escolha original na integração como alterações ou retiradas posteriores, quando aplicável.

5. Regras rígidas
Nenhuma caixa de seleção pode estar pré-selecionada.
A aplicação não deve permitir que um utilizador ignore a fase de aceitação legal e continue no produto sem concordância.
Os Termos e Condições e a Política de Privacidade devem estar acessíveis a partir da fase legal.
O aviso de segurança deve permanecer parte do texto de aceitação legal, a menos que a posição legal mude e as versões sejam atualizadas em conformidade.
A fase de permissões não deve agrupar análises, notificações e localização num único consentimento vago.
Cada escolha deve permanecer separadamente compreensível e separadamente registável.
Qualquer alteração material no texto legal, no modelo de permissão ou no comportamento monitorizado deve desencadear uma atualização de versão e uma nova aceitação, onde exigido.
