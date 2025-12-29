'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function History() {
  const [jobs, setJobs] = useState<any[]>([])

  useEffect(() => {
    supabase.from('jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .then(res => setJobs(res.data || []))
  }, [])

  return (
    <div>
      <h1>Histórico</h1>
      <table>
        <thead>
          <tr>
            <th>Data</th>
            <th>Status</th>
            <th>Resultado</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map(j => (
            <tr key={j.id}>
              <td>{new Date(j.created_at).toLocaleString()}</td>
              <td>{j.status}</td>
              <td>
                {j.result_urls?.map((u: string) => (
                  <a key={u} href={u} target="_blank">Download</a>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
