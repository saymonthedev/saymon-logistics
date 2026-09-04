'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import { Button, Card, EmptyState, Modal, PageHeader, Spinner } from '@/components/ui';
import { cn, formatDate, ROLE_LABEL } from '@/lib/utils';
import type { PaginatedResult, Role, UserRecord } from '@/lib/types';

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserRecord | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['users', { admin: true }],
    queryFn: () => api.get<PaginatedResult<UserRecord>>('/users', { pageSize: 100 }),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => api.patch(`/users/${id}`, { active }),
    onSuccess: () => {
      toast.success('Usuário atualizado');
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Falha ao atualizar usuário'),
  });

  return (
    <div>
      <PageHeader
        title="Usuários"
        description="Gerencie contas e níveis de acesso"
        actions={<Button onClick={() => setCreateOpen(true)}>Novo usuário</Button>}
      />

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner />
        </div>
      ) : !data || data.data.length === 0 ? (
        <Card>
          <EmptyState title="Nenhum usuário cadastrado" />
        </Card>
      ) : (
        <Card>
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Perfil</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Criado em</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.data.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3 font-medium text-slate-800">{u.name}</td>
                  <td className="px-4 py-3 text-slate-500">{u.email}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => setEditUser(u)} className="text-brand-600 hover:text-brand-700">
                      {ROLE_LABEL[u.role]}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset',
                        u.active ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-slate-100 text-slate-500 ring-slate-300',
                      )}
                    >
                      {u.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{formatDate(u.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => toggleActive.mutate({ id: u.id, active: !u.active })}
                      className="text-xs font-medium text-slate-500 hover:text-slate-700"
                    >
                      {u.active ? 'Desativar' : 'Ativar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <CreateUserModal open={createOpen} onClose={() => setCreateOpen(false)} />
      {editUser && <EditUserModal user={editUser} onClose={() => setEditUser(null)} />}
    </div>
  );
}

function CreateUserModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'OPERATOR' as Role });

  const mutation = useMutation({
    mutationFn: () => api.post('/users', form),
    onSuccess: () => {
      toast.success('Usuário criado');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setForm({ name: '', email: '', password: '', role: 'OPERATOR' });
      onClose();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Falha ao criar usuário'),
  });

  return (
    <Modal open={open} onClose={onClose} title="Novo usuário">
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Nome</label>
          <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Email</label>
          <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Senha</label>
          <input type="password" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Perfil</label>
          <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
            <option value="OPERATOR">Operador</option>
            <option value="SUPERVISOR">Supervisor</option>
            <option value="ADMIN">Administrador</option>
          </select>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button disabled={!form.name || !form.email || form.password.length < 6 || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? 'Salvando...' : 'Criar'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function EditUserModal({ user, onClose }: { user: UserRecord; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [role, setRole] = useState<Role>(user.role);

  const mutation = useMutation({
    mutationFn: () => api.patch(`/users/${user.id}`, { role }),
    onSuccess: () => {
      toast.success('Perfil atualizado');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      onClose();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Falha ao atualizar perfil'),
  });

  return (
    <Modal open onClose={onClose} title={`Editar perfil — ${user.name}`}>
      <div className="space-y-3">
        <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={role} onChange={(e) => setRole(e.target.value as Role)}>
          <option value="OPERATOR">Operador</option>
          <option value="SUPERVISOR">Supervisor</option>
          <option value="ADMIN">Administrador</option>
        </select>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
