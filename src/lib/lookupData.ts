import { supabase } from './supabase'
import type { Client, ExhibitionListItem } from '../types'
import type { Worker } from '../pages/ConstructionStaff'

export async function fetchClients(): Promise<Client[]> {
  const { data, error } = await supabase.from('clients').select('*').order('name')
  if (error) throw error
  return (data || []) as Client[]
}

export async function fetchExhibitionListItems(): Promise<ExhibitionListItem[]> {
  const { data, error } = await supabase.from('exhibition_list').select('*').order('name')
  if (error) throw error
  return (data || []) as ExhibitionListItem[]
}

export async function fetchConstructionWorkers(): Promise<Worker[]> {
  const { data, error } = await supabase.from('construction_workers').select('*').order('name')
  if (error) throw error
  return (data || []) as Worker[]
}
