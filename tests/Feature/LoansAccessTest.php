<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/** «امانات و لوازم»: فقط مدیر و معاونین دارای مجوز */
class LoansAccessTest extends TestCase
{
    private function loan(string $id = 'loan-1'): array
    {
        return ['id' => $id, 'data' => [
            'id' => $id, 'itemName' => 'ویدیو پروژکتور', 'loanDate' => '1405/07/14', 'recipientName' => 'آقای احمدی',
            'returned' => false, 'createdAt' => '2026-10-06T08:00:00Z',
        ]];
    }

    private function save($user, array $upserts = [], array $deletes = [])
    {
        return $this->actingAs($user)->postJson('/api/sync', ['collection' => 'loanItems', 'upserts' => $upserts, 'deletes' => $deletes]);
    }

    public function test_privileged_roles_can_create_update_and_delete(): void
    {
        foreach (['admin', 'vice_disciplinary', 'vice_educational', 'vice_principal'] as $role) {
            $user = $this->makeUser($role);
            $id = 'loan-'.$role;

            $this->save($user, [$this->loan($id)])->assertOk();
            $this->assertDatabaseHas('loan_items', ['id' => $id, 'item_name' => 'ویدیو پروژکتور', 'is_returned' => 0]);

            $item = $this->loan($id);
            $item['data']['returned'] = true;
            $item['data']['returnedDate'] = '1405/07/15';
            $this->save($user, [$item])->assertOk();
            $this->assertDatabaseHas('loan_items', ['id' => $id, 'is_returned' => 1]);

            $this->save($user, [], [$id])->assertOk();
            $this->assertDatabaseMissing('loan_items', ['id' => $id]);
        }
    }

    public function test_teachers_coaches_and_nurturing_vice_cannot_write(): void
    {
        foreach (['teacher', 'coach', 'vice_nurturing'] as $role) {
            $user = $this->makeUser($role);

            $this->save($user, [$this->loan('x-'.$role)])->assertForbidden();
            $this->assertDatabaseMissing('loan_items', ['id' => 'x-'.$role]);
        }
    }

    public function test_user_without_the_permission_cannot_write(): void
    {
        $vice = $this->makeUser('vice_disciplinary', ['permissions' => json_encode(['manage-attendance'])]);

        $this->save($vice, [$this->loan()])->assertForbidden();
    }

    public function test_loans_are_only_exported_to_privileged_roles(): void
    {
        $admin = $this->makeUser('admin');
        $this->save($admin, [$this->loan()])->assertOk();

        $this->assertCount(1, $this->actingAs($admin)->getJson('/api/bootstrap')->json('data.loanItems'));
        $this->assertCount(1, $this->actingAs($this->makeUser('vice_disciplinary'))->getJson('/api/bootstrap')->json('data.loanItems'));

        foreach (['teacher', 'coach', 'vice_nurturing'] as $role) {
            $body = $this->actingAs($this->makeUser($role))->getJson('/api/bootstrap')->assertOk();
            $this->assertSame([], $body->json('data.loanItems'), $role);
            $this->assertStringNotContainsString('ویدیو پروژکتور', $body->getContent());
        }
    }

    public function test_table_is_created_on_demand_and_row_columns_are_extracted(): void
    {
        $admin = $this->makeUser('admin');

        $this->save($admin, [$this->loan()])->assertOk();

        $row = DB::table('loan_items')->first();
        $this->assertSame('آقای احمدی', $row->recipient_name);
        $this->assertSame('1405/07/14', $row->loan_date);
    }
}
