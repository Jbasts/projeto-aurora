import type { ReactNode } from 'react'

import { TituloPagina } from '../components/TituloPagina'
import { useTituloDocumento } from '../hooks/useTituloDocumento'

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xl font-semibold text-texto">{titulo}</h2>
      {children}
    </section>
  )
}

function Lista({ itens }: { itens: ReactNode[] }) {
  return (
    <ul className="flex list-disc flex-col gap-1 pl-6">
      {itens.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  )
}

/** Página estática: quais dados são coletados e para quê (seção 3.11). */
export function PaginaPrivacidade() {
  useTituloDocumento('Privacidade')

  return (
    <article className="flex max-w-3xl flex-col gap-8 text-texto">
      <TituloPagina texto="Privacidade e" destaque="proteção de dados" />

      <p>
        O Projeto Aurora é uma plataforma de cadastro e mapeamento de pessoas em situação de rua em
        Petrópolis/RJ. Ela existe para direcionar ajuda humanitária: saber quem precisa de apoio e
        por onde costuma estar. Esta página explica quais dados guardamos, para quê e como eles são
        protegidos.
      </p>

      <Secao titulo="Dados das pessoas em situação de rua">
        <p>Pessoas colaboradoras do projeto podem registrar:</p>
        <Lista
          itens={[
            'nome, sobrenome, apelido e idade aproximada;',
            'contato (telefone e email) e uma pessoa de referência, quando houver;',
            'observações que ajudam no atendimento;',
            'fotos, somente quando a pessoa autorizou;',
            'locais, datas e horários em que a pessoa foi vista (avistamentos).',
          ]}
        />
        <p>
          Antes do cadastro, a pessoa é informada sobre ele. Fotos só podem ser enviadas com a
          autorização dela; sem autorização, o sistema bloqueia o envio. Ao receber uma foto,
          apagamos os metadados do arquivo (que podem conter a localização do aparelho).
        </p>
      </Secao>

      <Secao titulo="Dados de quem usa a plataforma">
        <Lista
          itens={[
            'nome, email e telefone informados no cadastro;',
            'senha, guardada apenas de forma cifrada (ninguém consegue lê-la);',
            'registros de uso: logins, alterações e visualizações de cadastros, com data, hora e endereço IP.',
          ]}
        />
      </Secao>

      <Secao titulo="Para que os dados são usados">
        <p>
          Somente para organizar e direcionar a ajuda humanitária do projeto. Os dados não são
          vendidos nem usados para outros fins.
        </p>
      </Secao>

      <Secao titulo="Quem tem acesso">
        <Lista
          itens={[
            'Apenas pessoas com conta aprovada por uma pessoa administradora do projeto.',
            'Cada perfil de acesso vê e faz somente o necessário: pessoas usuárias consultam; pessoas colaboradoras também cadastram e registram avistamentos; pessoas administradoras também gerenciam as contas.',
            'As fotos nunca ficam públicas: só abrem por links temporários, gerados para quem está logado.',
          ]}
        />
      </Secao>

      <Secao titulo="Segurança e registros">
        <Lista
          itens={[
            'O acesso é bloqueado por alguns minutos depois de várias tentativas de senha erradas.',
            'Cada visualização do cadastro de uma pessoa em situação de rua fica registrada, assim como cadastros, edições, fotos e avistamentos.',
            'Os registros técnicos do sistema guardam apenas identificadores, nunca dados pessoais das pessoas cadastradas.',
            'Um cadastro não é apagado: ele é inativado, deixa de aparecer no mapa e só pode ser consultado por pessoas colaboradoras e administradoras.',
          ]}
        />
      </Secao>

      <Secao titulo="Serviços externos">
        <Lista
          itens={[
            'Os mapas usam o OpenStreetMap: as imagens do mapa são baixadas dos servidores dele.',
            'O endereço aproximado de um avistamento é consultado no Nominatim (OpenStreetMap) a partir das coordenadas, sem nenhum dado da pessoa.',
            'A fonte do site vem do Google Fonts, e o tradutor de Libras é o VLibras, do Governo Federal (carregado só quando você o aciona).',
          ]}
        />
        <p>Esses serviços recebem o endereço IP do seu aparelho ao carregar esses conteúdos.</p>
      </Secao>

      <Secao titulo="Cookies e armazenamento no navegador">
        <p>
          Usamos um cookie necessário para manter você conectado(a) e guardamos no navegador as suas
          preferências de acessibilidade (tamanho do texto e modo escuro). Não usamos cookies de
          publicidade nem de rastreamento.
        </p>
      </Secao>

      <Secao titulo="Seus direitos">
        <p>
          Conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018), você pode pedir acesso,
          correção ou informações sobre o uso dos seus dados. Pessoas cadastradas também podem fazer
          esses pedidos diretamente às equipes do projeto em campo. Os pedidos podem ser feitos à
          coordenação do projeto, no endereço indicado no rodapé desta página.
        </p>
      </Secao>
    </article>
  )
}
